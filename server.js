#!/usr/bin/env node
// var app = require('./app');
import app from './app.js'
var port = process.env.PORT || 3115;
// const fs = require('fs');
// const http = require('http');
// const https = require('https');
import fs from 'fs'
import http from 'http'
import https from 'https'

// Starting both http & https servers


if(process.env.NODE_ENV==="development" || process.env.NODE_ENV==="setup") {
    const httpServer = http.createServer(app);
    httpServer.listen(3116, () => {
        console.log('HTTP Server running on port 3116');
        console.log(process.env.DB_ENV)
    });
} else {
    const privateKey = fs.readFileSync('/etc/letsencrypt/live/deimach.de/privkey.pem', 'utf8');
    const certificate = fs.readFileSync('/etc/letsencrypt/live/deimach.de/cert.pem', 'utf8');
    const ca = fs.readFileSync('/etc/letsencrypt/live/deimach.de/chain.pem', 'utf8');

    const credentials = {
        key: privateKey,
        cert: certificate,
        ca: ca
    };

    const httpsServer = https.createServer(credentials, app);
    httpsServer.listen(3115, () => {
        console.log('HTTPS Server running on port 3115');
    });
}
/*
var server = app.listen(port, function() {
  console.log('Express server listening on port ' + port);
});*/
