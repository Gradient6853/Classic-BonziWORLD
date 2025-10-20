var show = false;
        
        function showtoggle(){
            $('#logshow').hide();$('#mainlog').show()
            document.getElementById("logcontent").scrollTop = document.getElementById("logcontent").scrollHeight;
        }