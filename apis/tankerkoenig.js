/**
 * @file apis/tankerkoenig.js
 *
 * @author fewieden
 * @license MIT
 *
 * @see  https://github.com/fewieden/MMM-Fuel
 */

/**
 * Earth radius in meter.
 * @type {number}
 */
const earth = 6371e3;

/**
 * @external node-fetch
 * @see https://www.npmjs.com/package/node-fetch
 */
const fetch = require('node-fetch');

const BASE_URL = 'https://creativecommons.tankerkoenig.de/json/list.php';
const BASE_URL_DETAIL = 'https://creativecommons.tankerkoenig.de/json/detail.php';

let config;

/**
 * @function generateUrl
 * @description Helper function to generate API request url.
 *
 * @returns {string} url
 */
function generateUrl() {
    return `${BASE_URL}?lat=${config.lat}&lng=${config.lng}&rad=${config.radius}&type=all&apikey=${
        config.api_key}&sort=dist`;
}

/**
 * @function generateUrlDetail
 * @description Helper function to generate API request url.
 *
 * @returns {string} url
 */
function generateUrlDetail(id) {
    return `${BASE_URL_DETAIL}?id=${id}&apikey=${config.api_key}`;
}

/**
 * @function sortByPrice
 * @description Helper function to sort gas stations by price.
 *
 * @param {Object} a - Gas Station
 * @param {Object} b - Gas Station
 *
 * @returns {number} Sorting weight.
 */
function sortByPrice(a, b) {
    if (b[config.sortBy] === 0) {
        return Number.MIN_SAFE_INTEGER;
    } else if (a[config.sortBy] === 0) {
        return Number.MAX_SAFE_INTEGER;
    }

    return a[config.sortBy] - b[config.sortBy];
}

/**
 * @function filterStations
 * @description Helper function to filter gas stations.
 *
 * @param {Object} station - Gas Station
 *
 * @returns {boolean} To keep or filter the station.
 */
function filterStations(station) {
    for (let i = 0; i < config.types.length; i += 1) {
        if (station[config.types[i]] <= 0 || config.showOpenOnly && !station.isOpen) {
            return false;
        }
    }

    return true;
}

/**
* @function degrees_to_radians
* @description Calculates the radians.
*
* @param  {number} - Degrees
* @returns {number} - Return radians
*/
function deg2rad(degrees)
{
  var pi = Math.PI;
  return degrees * (pi/180);
}

/**
* @function getDistance
* @description Calculates the distance between two points.
*
* @param {Object.<number, number>} - Start point
* @param {Object.<number, number>} - Target point
* @returns {number} - Distance in kilometers
*/
function getDistance(pos1,pos2) {
    // Algorithm taken from https://stackoverflow.com/a/27943
    /* eslint-disable no-mixed-operators */
    const dLat = deg2rad(pos2.lat - pos1.lat);
    const dLon = deg2rad(pos2.lng - pos1.lng);
    const distance = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(pos1.lat)) * Math.cos(deg2rad(pos2.lat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(distance), Math.sqrt(1 - distance));
    return earth * c / 1000;
}

/**
 * @function checkStations
 * @description Helper function to filter gas stations.
 *
 * @param {Object} station - Gas Station
 *
 * @returns {boolean} To keep or filter the station.
 */
function checkStation(station) {
    for (let i = 0; i < config.types.length; i += 1) {
        if (station[config.types[i]] <= 0 || config.showOpenOnly && !station.isOpen) {
            return false;
        }
    }

    return true;
}

/**
 * @function normalizeStations
 * @description Helper function to normalize the structure of gas stations for the UI.
 *
 * @param {Object} value - Gas Station
 * @param {int} index - Array index
 * @param {Object[]} stations - Original Array.
 *
 * @returns {void}
 *
 * @see apis/README.md
 */
function normalizeStations(value, index, stations) {
    /* eslint-disable no-param-reassign */
    stations[index].prices = {
        diesel: value.diesel,
        e5: value.e5,
        e10: value.e10
    };
    stations[index].distance = value.dist;
    stations[index].address = `${`0${value.postCode}`.slice(-5)} ${
        value.place} - ${value.street} ${value.houseNumber}`;
    /* eslint-enable no-param-reassign */
}

/**
 * @function getData
 * @description Performs the data query and processing.
 * @async
 *
 * @returns {Object} Returns object described in the provider documentation.
 *
 * @see apis
 */
async function getData() {
    let stations;

    if (config.onlyStations.length < 1) {
        const response = await fetch(generateUrl());
        const parsedResponse = await response.json();

        if (!parsedResponse.ok) {
            throw new Error('Error no fuel data');
        }

        stations = parsedResponse.stations.filter(filterStations);

    } else {

        stations = [];

        for(let i = 0;i < config.onlyStations.length;i++) {
            const response = await fetch(generateUrlDetail(config.onlyStations[i]));
            const parsedResponse = await response.json();

            if (!parsedResponse.ok) {
                throw new Error('Error no fuel data or station id not found');
            }

            if (checkStation(parsedResponse.station)) {
                let station = parsedResponse.station;
                station["dist"]= getDistance(station,{"lat":config.lat,"lng":config.lng}).toFixed(1);
                stations.push(station);
            }
        }
    }

    stations.forEach(normalizeStations);

    const price = stations.slice(0);
    price.sort(sortByPrice);

    return {
        types: ['diesel', 'e5', 'e10'],
        unit: 'km',
        currency: 'EUR',
        byPrice: price,
        byDistance: stations
    };
}

/**
 * @module apis/tankerkoenig
 * @description Queries data from tankerkoenig.de
 *
 * @requires external:node-fetch
 *
 * @param {Object} options - Configuration.
 * @param {number} options.lat - Latitude of Coordinate.
 * @param {number} options.lng - Longitude of Coordinate.
 * @param {int} options.radius - Lookup area for gas stations.
 * @param {string} options.sortBy - Type to sort by price.
 * @param {string[]} options.types - Requested fuel types.
 * @param {boolean} options.showOpenOnly - Flag to show only open gas stations.
 *
 * @returns {Object} Object with function getData.
 *
 * @see https://creativecommons.tankerkoenig.de/
 */
module.exports = options => {
    config = options;

    return { getData };
};
