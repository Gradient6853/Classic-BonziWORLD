const log = require("./log.js").log;
const Ban = require("./ban.js");
const Utils = require("./utils.js");
const io = require('./index.js').io;
const settings = require("./settings.json");
const sanitize = require('sanitize-html');
const fs = require('fs-extra');

let roomsPublic = [];
let rooms = {};
let usersAll = [];
const forever = 99999999999999999999999999999999999999999999999999999999999999999999999999999999

exports.beat = function() {
    io.on('connection', function(socket) {
        new User(socket);
    });
};

function checkRoomEmpty(room) {
    if (room.users.length != 0) return;

    log.info.log('debug', 'removeRoom', {
        room: room
    });

    let publicIndex = roomsPublic.indexOf(room.rid);
    if (publicIndex != -1)
        roomsPublic.splice(publicIndex, 1);
    
    room.deconstruct();
    delete rooms[room.rid];
    delete room;
}

class Room {
    constructor(rid, prefs) {
        this.rid = rid;
        this.prefs = prefs;
        this.users = [];
    }

    deconstruct() {
        try {
            this.users.forEach((user) => {
                user.disconnect();
            });
        } catch (e) {
            log.info.log('warn', 'roomDeconstruct', {
                e: e,
                thisCtx: this
            });
        }
        //delete this.rid;
        //delete this.prefs;
        //delete this.users;
    }
    
    join(user) {
        user.socket.join(this.rid);
        this.users.push(user);

        this.updateUser(user);
    }

    leave(user) {
        // HACK
        try {
            this.emit('leave', {
                 guid: user.guid
            });
     
            let userIndex = this.users.indexOf(user);
     
            if (userIndex == -1) return;
            this.users.splice(userIndex, 1);
     
            checkRoomEmpty(this);
        } catch(e) {
            log.info.log('warn', 'roomLeave', {
                e: e,
                thisCtx: this
            });
        }
    }

    updateUser(user) {
		this.emit('update', {
			guid: user.guid,
			userPublic: user.public
        });
    }

    getUsersPublic() {
        let usersPublic = {};
        this.users.forEach((user) => {
            usersPublic[user.guid] = user.public;
        });
        return usersPublic;
    }

    emit(cmd, data) {
		io.to(this.rid).emit(cmd, data);
    }
}

function newRoom(rid, prefs) {
    rooms[rid] = new Room(rid, prefs);
    log.info.log('debug', 'newRoom', {
        rid: rid
    });
}

let userCommands = {
    /*"godmode": function(word) {
        let success = word == this.room.prefs.godword;
        if (success) { this.private.runlevel = 3; this.socket.emit("admin"); }
        log.info.log('debug', 'godmode', {
            guid: this.guid,
            success: success
        });
    },*/
    "sanitize": function() {
        let sanitizeTerms = ["false", "off", "disable", "disabled", "f", "no", "n"];
        let argsString = Utils.argsString(arguments);
        this.private.sanitize = !sanitizeTerms.includes(argsString.toLowerCase());
    },
    "joke": function() {
        this.room.emit("joke", {
            guid: this.guid,
            rng: Math.random()
        });
    },
    "fact": function() {
        this.room.emit("fact", {
            guid: this.guid,
            rng: Math.random()
        });
    },
    "youtube": function(vidRaw) {
        if(vidRaw.includes("\"")){
            this.room.emit("talk", {
                guid: this.guid,
                text:"I'M PRETENDING TO BE A 1337 HAX0R BUT I'M ACTUALLY A SKRIPT KIDDI LMAO"
            }); 
            return;
        }
        if(vidRaw.includes("'")){ 
            this.room.emit("talk", {
                guid: this.guid,
                text:"I'M PRETENDING TO BE A 1337 HAX0R BUT I'M ACTUALLY A SKRIPT KIDDI LMAO"
            }); 
            return;
        }
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("youtube", {
            guid: this.guid,
            vid: vid
        });
    },
    "emote": function() {
        let argsString = Utils.argsString(arguments);
        if(argsString == "cool"){ 
            this.room.emit("swag", {
                guid: this.guid
            });
        } if(argsString == "beat"){ 
            this.room.emit("chest", {
                guid: this.guid
            });
        } if(argsString == "clap"){ 
            this.room.emit("congrats", {
                guid: this.guid
            });
        } if(argsString == "surf"){ 
            this.room.emit("surfboard", {
                guid: this.guid
            });
        } if(argsString == "earth"){ 
            this.room.emit("globe", {
                guid: this.guid
            });
        }
    },
    "skin": function() {
        let argsString = Utils.argsString(arguments);
        if(argsString == "jinx"){
            this.public.color = "jinx";
            this.room.updateUser(this);
        } if(argsString == "christmas"){ 
            this.public.color = "christmas";
            this.room.updateUser(this);
        } if(argsString == "blessed"){ 
            this.public.color = "blessed";
            this.room.updateUser(this);
        }
    },
    "backflip": function(swag) {
        this.room.emit("backflip", {
            guid: this.guid,
            swag: swag == "swag"
        });
    },
    "linux": "passthrough",
    "pawn": "passthrough",
    "color": function(color) {
        if (typeof color != "undefined") {
            if (settings.bonziColors.indexOf(color) == -1)
                return;
            
            this.public.color = color;
        } else {
            let bc = settings.bonziColors;
            this.public.color = bc[
                Math.floor(Math.random() * bc.length)
            ];
        }
        this.room.updateUser(this);
    },
    "pope": function() {
        this.public.color = "pope";
        this.room.updateUser(this);
        this.room.emit("asshole2");
    },
    "oldgod": function() {
        if (this.private.runlevel < 3) {
            this.socket.emit("alert", "This command is for admins only!");
            return
        }
        this.public.color = "bwrisoverparty";
        this.room.updateUser(this);
    },
    kick: function (data) {
        if (this.private.runlevel < 2) {
            this.socket.emit("alert", "This command is only for mods & higher!");
            return
        }
        let pu = this.room.getUsersPublic()[data];
        if (pu && pu.color) {
            let target;
            this.room.users.map((n) => {
                if (n.guid == data) {
                    target = n;
                }
            });
            if (target.socket.request.connection.remoteAddress == "::1") {
                return;
            } else if (target.socket.request.connection.remoteAddress == "::ffff:127.0.0.1") {
                return;
            } else {
                target.socket.emit("kick", {
                    reason: "You got kicked.",
                });
                target.socket.disconnect();
            }
        }
    },
    bless: function (data) {
        if (this.private.runlevel < 2) {
            this.socket.emit("alert", "This command is only for mods & higher!");
            return
        }
        let pu = this.room.getUsersPublic()[data];
        if (pu && pu.color) {
            let target;
            this.room.users.map((n) => {
                if (n.guid == data) {
                    target = n;
                }
            });
             if (target.socket.request.connection.remoteAddress == "::1") {
                return;
            } else if (target.socket.request.connection.remoteAddress == "::ffff:127.0.0.1") {
                return;
            } else {
                target.socket.emit("bless", {
                    guid: target.guid,
                });
                target.private.runlevel = 1;
                target.public.color = "blessed";
                this.room.updateUser(target);
            }
        }
    },
    tempban: function (data, duration, why) {
        if (this.private.runlevel < 2) {
            this.socket.emit("alert", "This command is only for mods & higher!");
            return
        }
        let pu = this.room.getUsersPublic()[data];
        if (pu && pu.color) {
            let target;
            this.room.users.map((n) => {
                if (n.guid == data) {
                    target = n;
                }
            });
            if (target.socket.request.connection.remoteAddress == "::1") {
                Ban.removeBan(target.socket.request.connection.remoteAddress);
            } else if (target.socket.request.connection.remoteAddress == "::ffff:127.0.0.1") {
                Ban.removeBan(target.socket.request.connection.remoteAddress);
            } else {
                if(duration == 5) {
                Ban.addBan(target.socket.request.connection.remoteAddress, 5, why);
                target.socket.emit("ban", {
                    reason: data.reason,
                });
                target.disconnect();
               } else if(duration == 60) {
                Ban.addBan(target.socket.request.connection.remoteAddress, 60, why);
                target.socket.emit("ban", {
                    reason: data.reason,
                });
                target.disconnect();
               }
               else { this.socket.emit("alert","Nice try")}
            }
        }
    },
    ban: function (data, why) {
        if (this.private.runlevel < 3) {
            this.socket.emit("alert", "This command is for admins only!");
            return
        }
        let pu = this.room.getUsersPublic()[data];
        if (pu && pu.color) {
            let target;
            this.room.users.map((n) => {
                if (n.guid == data) {
                    target = n;
                }
            });
            if (target.socket.request.connection.remoteAddress == "::1") {
                Ban.removeBan(target.socket.request.connection.remoteAddress);
            } else if (target.socket.request.connection.remoteAddress == "::ffff:127.0.0.1") {
                Ban.removeBan(target.socket.request.connection.remoteAddress);
            } else {
                Ban.addBan(target.socket.request.connection.remoteAddress, forever, why);
                target.socket.emit("ban", {
                    reason: data.reason,
                });
                target.disconnect();
            }
        }
    },
    info: function (data) {
        if (this.private.runlevel < 3) {
            this.socket.emit("alert", "This command is for admins only!");
            return
        }
        let pu = this.room.getUsersPublic()[data];
        if (pu && pu.color) {
            let target;
            this.room.users.map((n) => {
                if (n.guid == data) {
                    target = n;
                }
            });
            {
                this.socket.emit("alert","GUID: "+target.guid+"\n IP: "+target.getIp().substring(7)+"")
            }
        }
    },
    stop: function () {
        if (this.private.runlevel < 3) {
            this.socket.emit("alert", "This command is for admins only!");
            return
        }
        process.exit()
    },
    "asshole": function() {
        this.room.emit("asshole", {
            guid: this.guid,
            target: sanitize(Utils.argsString(arguments))
        });
    },
    video: function (vidRaw) {
            if(!vidRaw.match(/catbox/gi)) return;
            var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
            this.room.emit("video", {
                guid: this.guid,
                vid: vid,
            });
        },
       image: function (vidRaw) {
            if(!vidRaw.match(/catbox/gi) && !vidRaw.match(/i.ibb.co/gi) && !vidRaw.match(/ibb.co/gi) && !vidRaw.match(/i.imgur.com/gi)) return;
            var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
            this.room.emit("image", {
                guid: this.guid,
                vid: vid,
            });
        },
    "owo": function() {
        this.room.emit("owo", {
            guid: this.guid,
            target: sanitize(Utils.argsString(arguments))
        });
    },
    "triggered": "passthrough",
    "vaporwave": function() {
        this.socket.emit("vaporwave");
    },
    "unvaporwave": function() {
        this.socket.emit("unvaporwave");
    },
    "name": function() {
        let argsString = Utils.argsString(arguments);
        if(this.private.runlevel == 3){
            let name = argsString || this.room.prefs.defaultName;
            this.public.name = name;
            this.room.updateUser(this);
        } else {
        if (argsString.length > this.room.prefs.name_limit)
            return;

        let name = argsString || this.room.prefs.defaultName;
        this.public.name = this.private.sanitize ? sanitize(name) : name;
        this.room.updateUser(this);
       }
    },
    broadcast: function (...text) {
        if (this.private.runlevel < 3) {
            this.socket.emit("alert", "This command is for admins only!");
            return
        }
        this.room.emit("broadcast", { msg: text.join(' '), sanitize: false, title: "Broadcast from " + this.public.name });
    },
    "pitch": function(pitch) {
        pitch = parseInt(pitch);

        if (isNaN(pitch)) return;

        this.public.pitch = Math.max(
            Math.min(
                parseInt(pitch),
                this.room.prefs.pitch.max
            ),
            this.room.prefs.pitch.min
        );

        this.room.updateUser(this);
    },
    "speed": function(speed) {
        speed = parseInt(speed);

        if (isNaN(speed)) return;

        this.public.speed = Math.max(
            Math.min(
                parseInt(speed),
                this.room.prefs.speed.max
            ),
            this.room.prefs.speed.min
        );
        
        this.room.updateUser(this);
    }
};


class User {
    constructor(socket) {
        this.guid = Utils.guidGen();
        this.socket = socket;

        // Handle ban
	    if (Ban.isBanned(this.getIp())) {
            Ban.handleBan(this.socket);
        }

        this.private = {
            login: false,
            sanitize: true,
            runlevel: 0
        };

        this.public = {
            color: settings.bonziColors[Math.floor(
                Math.random() * settings.bonziColors.length
            )]
        };
        /*log.info.log('info', 'connect', {
            guid: this.guid,
            ip: this.getIp()
        });*/
        console.log(""+this.getIp()+" has connected");
        fs.appendFileSync('./logs.txt', ''+this.getIp()+' has connected '+new Date().toLocaleString()+'\n');
        this.speakAgain = true;
       this.socket.on('login', this.login.bind(this));
    }

    getIp() {
        return this.socket.request.connection.remoteAddress;
    }

    getPort() {
        return this.socket.handshake.address.port;
    }

    login(data) {
        if (typeof data != 'object') return; // Crash fix (issue #9)
        
        if (this.private.login) return;

		/*log.info.log('info', 'login', {
			guid: this.guid,
            name: this.public.name,
            ip: this.getIp(),
            room: data.room,
        });*/
        console.log(""+this.getIp()+" has joined the server with the room: "+data.room+"");
        fs.appendFileSync('./logs.txt', ''+this.getIp()+' has joined the server with the room: "'+data.room+'" '+new Date().toLocaleString()+'\n');
        //admins
        if (this.getIp() == "::1" || this.getIp() == "::ffff:127.0.0.1") {
            this.private.runlevel = 3;
            this.socket.emit("admin");
            this.private.sanitize = false;
        }
        // mods
        if (this.getIp() == "CHANGE THIS TO WHATEVER USER'S IP") {
            this.private.runlevel = 2;
            this.socket.emit("moderator");
        }
        let count = 0;
        for (const i in rooms) {
            const room = rooms[i];
            for (let u in room.users) {
                const user = room.users[u];
                if (user.getIp() == this.getIp()) {
                    count++;
                }
            }
        }
        if (count > 1) {
            this.socket.emit("loginFail", {
                reason: "AntiFlood",
            });
            return;
        }
        let rid = data.room;
        
		// Check if room was explicitly specified
		var roomSpecified = true;

		// If not, set room to public
		if ((typeof rid == "undefined") || (rid === "")) {
			//rid = roomsPublic[Math.max(roomsPublic.length - 1, 0)];
			//roomSpecified = false;
            rid = "default";
			roomSpecified = true;
		}
		log.info.log('debug', 'roomSpecified', {
			guid: this.guid,
			roomSpecified: roomSpecified
        });
        
		// If private room
		if (roomSpecified) {
            if (sanitize(rid) != rid) {
                this.socket.emit("loginFail", {
                    reason: "nameMal"
                });
                return;
            }

			// If room does not yet exist
			if (typeof rooms[rid] == "undefined") {
                if (rid == "default"){
                var tmpPrefs = JSON.parse(JSON.stringify(settings.prefs.public));
                    //tmpPrefs.owner = this.guid;
                    newRoom(rid, tmpPrefs);
				    roomsPublic.push(rid);
                } else {
				// Clone default settings
				var tmpPrefs = JSON.parse(JSON.stringify(settings.prefs.private));
				// Set owner
				tmpPrefs.owner = this.guid;
                newRoom(rid, tmpPrefs);
                }
			}
		// If public room
		} else {
			// If room does not exist or is full, create new room
			if ((typeof rooms[rid] == "undefined")) {
				rid = Utils.guidGen();
				roomsPublic.push(rid);
				// Create room
				newRoom(rid, settings.prefs.public);
			}
        }
        
        this.room = rooms[rid];
            
        // Check name
		this.public.name = sanitize(data.name) || this.room.prefs.defaultName;

		if (this.public.name.length > this.room.prefs.name_limit)
			return this.socket.emit("loginFail", {
				reason: "nameLength"
			});
        
		if (this.room.prefs.speed.default == "random")
			this.public.speed = Utils.randomRangeInt(
				this.room.prefs.speed.min,
				this.room.prefs.speed.max
			);
		else this.public.speed = this.room.prefs.speed.default;

		if (this.room.prefs.pitch.default == "random")
			this.public.pitch = Utils.randomRangeInt(
				this.room.prefs.pitch.min,
				this.room.prefs.pitch.max
			);
		else this.public.pitch = this.room.prefs.pitch.default;

        // Join room
        this.room.join(this);

        this.private.login = true;
        this.socket.removeAllListeners("login");

		// Send all user info
		this.socket.emit('updateAll', {
			usersPublic: this.room.getUsersPublic()
		});

		// Send room info
		this.socket.emit('room', {
			room: rid,
			isOwner: this.room.prefs.owner == this.guid,
			isPublic: roomsPublic.indexOf(rid) != -1
		});

        this.socket.on('talk', this.talk.bind(this));
        this.socket.on('command', this.command.bind(this));
        this.socket.on('disconnect', this.disconnect.bind(this));
    }

    talk(data) {
        if (typeof data != 'object' || typeof data.text != "string") { // Crash fix (issue #9)
            data = {
                text: "HEY EVERYONE LOOK AT ME I'M TRYING TO SCREW WITH THE SERVER LMAO"
            };
            console.log(""+this.public.name+" tried to crash the server. what a dumbass :skull:");
            fs.appendFileSync('./logs.txt', ''+this.public.name+' tried to crash the server. what a dumbass :skull: '+new Date().toLocaleString()+'\n');
        }
        data.text = data.text.replace(/\\n/gi,"<br>")
        if (this.speakAgain || this.private.runlevel == 3) {
        /*log.info.log('info', 'talk', {
            guid: this.guid,
            text: data.text,
            name: this.public.name,
            ip: this.getIp(),
            room: data.room
        });*/
        if (this.speakAgain || this.private.runlevel == 3) {
            if (data.text.length <= this.room.prefs.char_limit && (data.text.length > 0)) {
        console.log(""+this.public.name+" said: ''"+data.text+"'' Guid: "+this.guid+" IP "+this.getIp()+"");fs.appendFileSync('./logs.txt', ''+this.public.name+' said: '+data.text+' Guid: '+this.guid+' IP '+this.getIp()+' '+new Date().toLocaleString()+'\n'); } }
        if (typeof data.text == "undefined")
            return;

        let text = this.private.sanitize ? sanitize(data.text) : data.text;

        if ((text.length <= this.room.prefs.char_limit) && (text.length > 0)) {
            this.room.emit('talk', {
                guid: this.guid,
                text: text
            });
        }
        if (this.private.runlevel != 3) {

                this.speakAgain = false;
                var _this = this;
                setTimeout(function(){
                    _this.speakAgain = true;
                },2000)
                
            }
        }
    }

    command(data) {
        if (typeof data != 'object') return; // Crash fix (issue #9)

        var command;
        var args;
        
        try {
            var list = data.list;
            command = list[0].toLowerCase();
            args = list.slice(1);
    
            log.info.log('debug', command, {
                guid: this.guid,
                args: args
            });

            if (this.private.runlevel >= (this.room.prefs.runlevel[command] || 0)) {
                let commandFunc = userCommands[command];
                if (commandFunc == "passthrough")
                    this.room.emit(command, {
                        "guid": this.guid
                    });
                else commandFunc.apply(this, args);
            } else
                this.socket.emit('commandFail', {
                    reason: "runlevel"
                });
        } catch(e) {
            log.info.log('debug', 'commandFail', {
                guid: this.guid,
                command: command,
                args: args,
                reason: "unknown",
                exception: e
            });
            this.socket.emit('commandFail', {
                reason: "unknown"
            });
        }
    }

    disconnect() {
		let ip = "N/A";
		let port = "N/A";

		try {
			ip = this.getIp();
			port = this.getPort();
		} catch(e) { 
			log.info.log('warn', "exception", {
				guid: this.guid,
				exception: e
			});
		}

		/*log.info.log('info', 'disconnect', {
			guid: this.guid,
			ip: ip,
			port: port
		});*/
        console.log(""+ip+" has disconnected");
        fs.appendFileSync('./logs.txt', ''+ip+' has disconnected '+new Date().toLocaleString()+'\n');
        this.socket.broadcast.emit('leave', {
            guid: this.guid
        });
        
        this.socket.removeAllListeners('talk');
        this.socket.removeAllListeners('command');
        this.socket.removeAllListeners('disconnect');

        this.room.leave(this);
    }
}
