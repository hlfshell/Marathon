var pushover = require('pushover')
var async = require('async')
var fs = require('fs-extra')
var config = require('./config')

module.export = function(){

	var repos = pushover(function(repo){
		//Dynamically figure out where the repos will be stored.
		if(!fs.existsSync(__dirname + '/apps/' + repo){
			fs.mkdirSync(__dirname + '/apps/' + repo)
		}

		//Code for apps will be stored in apps/reposName/repos
		return __dirname + '/apps/' + repo + '/repos'

	})

	repos.on('push', function(push){

		async.waterfall([

			function(done){
				if(config.git.auth){
					//TODO - something if there's git auth
				} else {
					//accept the push, placing the code in the repos
					push.accept()
					done(null)
				}
			},

			function(done){
				//Let's find the application object in applications[]
			}

		], function(err){

		})

	})

}