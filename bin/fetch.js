const axios = require('axios');

/**
 * @param {string} endpoint 
 * @param {string} accessToken 
 */
async function callApi(endpoint, accessToken) {

    const options = {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    };

   // console.log('request made to web API at: ' + new Date().toString());

    try {
        const response = await axios.default.get(endpoint, options);
        return response;
    } catch (error) {
        console.log(error,"error in fetch")
        return error;
    }
};

module.exports = {
    callApi: callApi
};