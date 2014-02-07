var async = require('async')
var config = require('./config')

module.exports = function(docker){

	function Application(name, image){
		this.name = name
		this.containers = []
		this.startedAt = null
	}

	/*
	* containerStatuses( callback(err, statuses) )
	*
	* Check the status of the application.
	* Expected return:
	* [ { container: containerObj, status: true/false } ]
	*/
	Application.prototype.containerStatuses = function(cb){
		var self = this
		if(fs.existsSync(__dirname + '/apps/' + self.name + '/status.lock')){
			//Because the status is locked, we return a in-progress notification
			cb('Status is being checked already', null)
			return
		} else {
			fs.writeFileSync(__dirname + '/apps/' + self.name + '/status.lock', 'Lock ALL the statuses! Eh - actually, wait - just this one')
		}

		var containerStatuses = []
		async.each(self.containers, function(container, done){

			container.inspect(function(err, inspect){
				if(err){
					done(err)
				} else {
					containerStatuses.push({
						container: container,
						status: inspect.State.Running,
						startedAt: inspect.State.StartedAt
					})
					done(null)
				}
			})

		}, function(err){
			//Release lock
			fs.unlinkSync(__dirname + '/apps/' + self.name + '/status.lock')
			//Return!
			cb(err, containerStatuses)
		})
	}

	/*
	* launchContainer( callback(err, container) )
	*
	* Adds a container to the object, including updating the container
	* file in our app folder.
	* Note - this uses a lock for transactions issues, so it might be
	* delayed
	*
	* Returns error, new container
	*/
	Application.prototype.launchContainer(cb){
		var self = this
		if(fs.existsSync(__dirname + '/apps/' + self.name + '/containers.lock')){
			//Because the containers isdo file locked, we set a timeout, return,
			//and the timeout retries this until unlocked.
			setTimeout(self.launchContainer(cb), config.marathon.lockDelay)
			return
		} else {
			fs.writeFileSync(__dirname + '/apps/' + self.name + '/containers.lock', 'Such container. Much Lock. Wow.')
		}

		async.waterfall([

			//create the container
			function(done){
				docker.createContainer({
					image: self.image
				}, function(err, container){
					done(err, container)
				})
			},

			//Read the container file for this app
			function(container, done){
				fs.readFile(__dirname + '/apps/' + self.name + '/containers', function(err, data){
					if(err){
						done(err)
					} else {
						done(null, container, JSON.parse(data))
					}
				})
			},

			//Append the container to the containers and save!
			function(container, containers, done){
				containers.push(container)
				self.containers = containers
				fs.writeFile(__dirname + '/apps/' + self.name + '/containers', JSON.stringify(containers), function(err){
					done(err, container)
				}
			}

		], function(err, container){
			//Release lock
			fs.unlinkSync(__dirname + '/apps/' + self.name + '/containers.lock')
			//Return!
			cb(err, container)
		})
	}

	/*
	* loadContainers( callback(err, containers) )
	*
	* Loads containers from json file containers,
	* returns containers. Note - affected by container
	* lock
	*/
	Application.prototype.loadContainers(cb){
		var self = this
		if(fs.existsSync(__dirname + '/apps/' + self.name + '/containers.lock')){
			//Because the containers isdo file locked, we set a timeout, return,
			//and the timeout retries this until unlocked.
			setTimeout(this.launchContainer(cb), config.marathon.lockDelay)
			return
		} else {
			fs.writeFileSync(__dirname + '/apps/' + self.name + '/containers.lock', 'Such container. Much Lock. Wow.')
		}

		async.waterfall([

			//Read the container file for this app
			function(done){
				fs.readFile(__dirname + '/apps/' + self.name + '/containers', function(err, data){
					if(err){
						done(err)
					} else {
						done(null, JSON.parse(data))
					}
				})
			},

			//For each containers ID, try and find the matching container
			//in docker. Load as dockerode container object
			function(savedContainers, done){
				containers = []
				async.each(savedContainers, function(savedContainer, done){

					var container = docker.getContainer(savedContainer.id)
					if(container){
						containers.push(container)
					}
					done(null)

				}, function(err){
					if(!err){
						self.containers = containers
					}
					done(err, containers)
				})
			}


		] function(err, containers){
			//Release lock
			fs.unlinkSync(__dirname + '/apps/' + self.name + '/containers.lock')
			//Return!
			cb(err, containers)
		})
	}

	//TODO: comment
	Application.prototype.daemonFocussed(){
		if(fs.existsSync(__dirname + '/apps/' + self.name + '/daemon.lock')){
			return false
		} else {
			fs.writeFileSync(__dirname + '/apps/' + self.name + '/daemon.lock', 'You have the eye of the daemon upon you')
			return true
		}
	}

	//TODO: comment
	Application.prototype.daemonUnfocussed(){
		if(!fs.existsSync(__dirname + '/apps/' + self.name + '/daemon.lock')){
			return false
		} else {
			fs.unlinkSync(__dirname + '/apps/' + self.name + '/daemon.lock')
			return true
		}
	}

	return Application
}