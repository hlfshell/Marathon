var async = require('async')
var config = require('./config')
var ASQ = require('./asynquence')

module.exports = function(docker){

	function Application(name, image){
		this.name = name
		this.versions = []
		this.containers = []
		this.startedAt = null

		this.config = null

		//daemon focus lock
		this.daemonFocus = false

		//Loading sequences to make sure that only one update/start
		//containers/images is done at a time
		this.containerLoad = ASQ()
		this.imagesLoad = ASQ()

		//To prevent overwriting the most up to date change with an older one,
		//or losing information, I will be using asynquence queues to keep
		//writes in series.
		this.containerWrites = ASQ()
		this.configWrites = ASQ()
	}

	/*
	* loadApplication(callback(err, application))
	* 
	* Load the application from memory if it exists.
	* This would only be called on initial daemon startup,
	* which would be loading from memory applications we
	* already know about
	*
	*/
	Application.prototype.loadApplication(cb){
		var self = this

		//There are a few files that we know of that are important to us.

		//config - for app specific settings.

		//versions - JSON file of all version objects

		//images - list of all images the application has, including the current



	}

	/*
	* createApplication(callback(err, application))
	*
	* This is called when a new application is created.
	* It will create all necessary application files and
	* folders.
	*
	*/
	Application.prototype.createApplication(cb){

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
			//Return!
			cb(err, containerStatuses)
		})
	}

	/*
	* createContainer( callback(err, container) )
	*
	* Creates a new container for this application. It then
	* updates the container file in the application directory
	* with the container's information
	*
	* Returns error, new container
	*/
	Application.prototype.createContainer(cb){
		var self = this

		async.waterfall([

			//create the container
			function(done){
				docker.createContainer({
					image: self.image
				}, function(err, container){
					done(err, container)
				})
			},

			//Using the container write queue, write the container
			//to the file via reading then writing the JSON object.
			function(container, done){

				self.containerWrites.then(function(cb){

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

						//Append the container to the containers and save!
						function(containers, done){
							containers.push(container)
							self.containers = containers
							fs.writeFile(__dirname + '/apps/' + self.name + '/containers', JSON.stringify(containers), function(err){
								done(err, container)
							}
						}

					], function(err){
						done(err, container)
						cb(null)
					})

				})

			}

		], function(err, container){
			//Return!
			cb(err, container)
		})
	}

	/*
	* loadContainers( callback(err, containers) )
	*
	* Loads containers from json file containers,
	* returns containers.
	*/
	Application.prototype.loadContainers(cb){
		var self = this

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
			//Return!
			cb(err, containers)
		})
	}

	//We do not want to scan the same application many times and fire off
	//multiple start container commands if it's in the process of doing so
	//already. As such, we keep track if the application is currently taking
	//care of commands from a container.
	Application.prototype.daemonFocussed(){
		if(!this.daemonFocus){
			this.daemonFocus = true
			return true
		} else {
			return false
		}
	}

	//Announces that the daemon is no longer a target of focus, allowing
	//the daemon to check statuses and order more work to be done.
	Application.prototype.daemonUnfocussed(){
		if(this.daemonFocus){
			this.daemonFocus = false
			return true
		} else {
			return false
		}
	}

	return Application
}