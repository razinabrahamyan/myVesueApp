import axios from 'axios';

const reqData = {
    method: 'GET',
    url: '',
    queryParams: {},
    formData: {},
    bodyParams: {},
    pathParams: [],
    data: {}
};

function makeHeaders(type) {
    let headers;
    if(type === "file"){
        headers = {
            'Content-Type': 'multipart/form-data',
        };
    } else {
        headers = {
            'Content-Type': 'application/json',
        };
    }
    return headers;
};

export async function defaultApi(url, method, details, type = '') {
    const URL = `https://myvesu.aurosystem.com/api`.toString();
    const api = axios.create({
        baseURL: URL,
        headers: makeHeaders(type),
    });
    let requestDetails = {...reqData};
    requestDetails.url = url;
    requestDetails.method = method;
    requestDetails.data = details;
    return api(requestDetails)
        .then(response => response)
        .catch(err => err)
};
