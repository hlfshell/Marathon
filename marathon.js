var portscanner = require('portscanner')
var fs = require('fs-extra')

if(!fs.exists(__dirname + '/config')){
	console.log("Could not find configuration file 'config' in Marathon home directory.")
	process.exit()
}

var config = require('./config')

var applications = require('./ApplicationList')

portscanner.checkPortStatus(config.marathon.port, '127.0.0.1', function(err, status) {
	if(status != 'open'){
		console.log("The chosen port for Marathon is not available.")
		process.exit()
	}

	var express = require('express')
	var app = express()
	require('./Routes')(app, applications)

	app.listen(config.marathon.port)
	console.log("Marathon server is now listening on port " + config.marathon.port)
})

if(config.git.useGit){
	portscanner.checkPortStatus(config.git.port, '127.0.0.1', function(err, status){
		if(status != 'open'){
			console.log("The chosen port for Marathon's git functionality is not available.")
			process.exit()
		}

		var repos = require('./gitResponses')

		var http = require('http')
		var server = http.createServer(function (req, res) {
		    repos.handle(req, res)
		}) 
		server.listen(config.git.port)
		console.log("Marathon is now listening for git pushes on port " + config.git.port)

	})
}