// server.js
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Apply stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('combined'));
app.use(helmet());

// Apply rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Cache for flight results to minimize scraping frequency
const flightCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Validation middleware for search params
const validateSearchParams = [
  body('origin').isString().isLength({ min: 3, max: 4 }),
  body('destination').isString().isLength({ min: 3, max: 4 }),
  body('departureDate').isString().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('returnDate').optional().isString().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('adults').optional().isInt({ min: 1, max: 9 }).default(1),
  body('children').optional().isInt({ min: 0, max: 9 }).default(0),
  body('infants').optional().isInt({ min: 0, max: 9 }).default(0),
  body('cabin').optional().isIn(['economy', 'premium_economy', 'business', 'first']).default('economy'),
];

// Utility function to generate cache key
const generateCacheKey = (params) => {
  return `${params.origin}_${params.destination}_${params.departureDate}_${params.returnDate || 'oneway'}_${params.adults}_${params.children}_${params.infants}_${params.cabin}`;
};

// Google Flights scraper function
async function scrapeGoogleFlights(params) {
  const {
    origin,
    destination,
    departureDate,
    returnDate,
    adults = 1,
    children = 0,
    infants = 0,
    cabin = 'economy',
  } = params;

  // Build the Google Flights URL
  let url = `https://www.google.com/travel/flights?hl=en&q=Flights%20from%20${origin}%20to%20${destination}%20on%20${departureDate}`;
  
  if (returnDate) {
    url += `%20returning%20${returnDate}`;
  }
  
  // Add passengers information
  url += `&tfs=CAEQARoQ&qs=CAEQARoQagcIARIDMgI4AQ&curr=USD`;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  });

  try {
    console.log(`Scraping flights from ${origin} to ${destination} on ${departureDate}`);
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Set request interception to block images and other non-essential resources for faster scraping
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Navigate to Google Flights
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for flights to load
    await page.waitForSelector('[data-test-id="offer-list"]', { timeout: 60000 });
    
    // Extract flight data
    const flights = await page.evaluate(() => {
      const results = [];
      const flightElements = document.querySelectorAll('[data-test-id="offer-list"] li');
      
      flightElements.forEach(flight => {
        try {
          // Basic flight details
          const priceElement = flight.querySelector('[data-test-id="price"]');
          const airlineElement = flight.querySelector('[data-test-id="airline"]');
          const durationElement = flight.querySelector('[data-test-id="duration"]');
          const departureTimeElement = flight.querySelector('[data-test-id="departure-time"]');
          const arrivalTimeElement = flight.querySelector('[data-test-id="arrival-time"]');
          const stopsElement = flight.querySelector('[data-test-id="stops"]');
          
          if (!priceElement) return; // Skip if no price
          
          // Extract data
          const price = priceElement ? priceElement.textContent.trim() : 'N/A';
          const airline = airlineElement ? airlineElement.textContent.trim() : 'N/A';
          const duration = durationElement ? durationElement.textContent.trim() : 'N/A';
          const departureTime = departureTimeElement ? departureTimeElement.textContent.trim() : 'N/A';
          const arrivalTime = arrivalTimeElement ? arrivalTimeElement.textContent.trim() : 'N/A';
          const stops = stopsElement ? stopsElement.textContent.trim() : 'N/A';
          
          results.push({
            price,
            airline,
            duration,
            departureTime,
            arrivalTime,
            stops,
            link: window.location.href,
          });
        } catch (error) {
          console.error("Error extracting flight data:", error);
        }
      });
      
      return results;
    });
    
    return flights;
  } catch (error) {
    console.error('Scraping error:', error);
    throw new Error(`Failed to scrape flights: ${error.message}`);
  } finally {
    await browser.close();
  }
}

// Endpoint to search flights
app.post('/api/search-flights', validateSearchParams, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const params = req.body;
  const cacheKey = generateCacheKey(params);

  try {
    // Check cache first
    if (flightCache.has(cacheKey)) {
      const cachedData = flightCache.get(cacheKey);
      if (Date.now() - cachedData.timestamp < CACHE_TTL) {
        console.log('Returning cached flight data');
        return res.json({
          success: true,
          data: cachedData.data,
          isCached: true,
          cacheAge: Math.round((Date.now() - cachedData.timestamp) / 1000),
        });
      }
    }

    // If not in cache or cache expired, scrape new data
    const flightData = await scrapeGoogleFlights(params);
    
    // Update cache
    flightCache.set(cacheKey, {
      timestamp: Date.now(),
      data: flightData,
    });
    
    res.json({
      success: true,
      data: flightData,
      isCached: false,
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
