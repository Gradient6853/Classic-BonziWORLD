function tempban() {
	var xv = document.getElementById("tempbanmenu_reason").value;
    var x11 = document.getElementById("temphidden_user").value;
    var x9 = document.getElementById("templengths").value;
	socket.emit("command", {list:["tempban",x11,x9,xv]});
	var x777 = document.getElementById("page_tempbanmenu");
	if (x777.style.display === "none") {
		x777.style.display = "block";
	} else {
		x777.style.display = "none";
	}
}

function hidetempbanmenu() { 
	document.getElementById("page_tempbanmenu").style.display = "none";
    }