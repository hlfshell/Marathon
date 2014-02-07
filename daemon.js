var async = require('async')

var config = require('./config')

var swig = require('swig')

var Docker = require('dockerode')
var docker = new Docker(config.docker.connection)

//models
var Application = require('./application')(docker)

var portscanner = require('portscanner')

var fs = require('fs-extra')
//Ensure that we have the correct folders created. Synchronous on purpose
if(!fs.exists(__dirname + '/apps')){
	//Allow error on this to bubble up and crash - only real error
	//is we don't have write access
	fs.mkdirSync(__dirname + '/apps')
}

//Build up our repertoire of apps
var appsFiles = fs.readdirSync(__dirname + '/apps')
var appsFolders = []
appFiles.forEach(function(appFile){
	if(appsFile.statSync().isDirectory()){
		appsFolders.push(appsFile)
	}
})
delete appsFiles

//We have app folders. Build the app objects.
//App object contains name (dir name) and ids for containers
var applications = []
appsFolders.forEach(function(appFolder){

	//clear out all known tmp files that were used for locking status
	var locks = [ 'containers', 'settings', 'status', 'daemonsEye']
	locks.forEach(function(lock){
		if(fs.existsSync(__dirname + '/apps/' + appFolder + '/' + lock + '.lock')){
			fs.unlinkSync(__dirname + '/apps/' + appFolder + '/' + lock + '.lock')
		}
	})

	//Inside of each app folder is two files and a folder.
	//Folder is a repos of code as is
	//Files are: 1) container information and 2) app configuration info
	var app = {
		name: appFolder,
		conf: JSON.parse(fs.readFileSync(__dirname + '/apps/' + appFolder + '/conf')),
		containers: JSON.parse(fs.readFileSync(__dirname + '/apps/' + appFolder + '/containers')))
	}

	applications.push(app)
})
delete appFolders

//Don't try to launch apps if nginx is down. Also - engaged sounds cool.
var nginxEngaged = false
var nginx = require('nginx-vhosts')(
	{
		confDir: config.nginx.confDir,
		pidLocation: config.nginx.pidLocation
	},
	function(nginxStatus){
		if(nginxStatus){
			nginxEngaged = true
		} else {
			//If the status is false, kill? Don't know. Might be good to fail gracefully or fire alerts
			nginxEngaged = false
		}
	}
)

//TODO - read command line arguments

var daemon = function(){

	var checkOnApp = function(){
		//If nginx is off, we must not do anything
		if(!nginxEngaged){
			setTimeout(checkOnApp, config.daemon.appCheckDelay)
			return
		}

		async.each(applications, function(application, done){

			async.waterfall([

				function(done){
					if(application.daemonFocussed()){
						done(null)
					} else {
						done('Daemon is already focussed on this')
					}
				}

				function(done){
					application.containerStatuses(function(err, statuses){
						done(err, statuses)
					})
				},

				function(statuses, done){
					var downContainers = []
					async.each(statuses, function(status, done){

						if(!status.status){
							downContainers.push(status.container)
						}

					}, function(err){
						done(err, downContainers)
					})
				},

				//For each downContainer, bring it back up
				function(downContainers, done){
					async.each(downContainers, function(downContainer, done){

						//TODO - load confs somehow?
						downContainer.start(TODO, function(err, data){
							//Do anything with err or data?
							done(null)
						})

					}, function(err){
						done(err)
					})
				},

				//Check to see if we have two containers loaded for this application. If not, then we need to create one!
				//TODO

			], function(err){
				application.daemonUnfocussed()
				done(null)
			})

		}, function(err){
			//TODO - better error handling/logging/reporting
			if(err){
				console.log("Error!", err)
			} else {
				setTimeout(checkOnApp, config.daemon.appCheckDelay)
			}
		})
	}

	//Start checking
	checkOnApp()
}