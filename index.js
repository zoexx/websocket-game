// ----------------- 数据定义部分 -----------------

// 客户端名单
var customers = [] , customerCounter = 1 ;
// 定义消息类型
var msgType = {
    // 发给客户端的
    "aboutU" : 1 ,      // 关于客户端自己的消息
    "aboutOthers" : 2 , // 其他客户端的广播消息
};

var msgAction = {
    "giveAName" : 1 ,
    "someOneIsOnline" : 2 ,
};

function createMsg( type , action , data ){
    return JSON.stringify({
        "type" : type ,
        "payload" : {
            "action" : action ,
            "data" : data ,
        },
    })
}


// -------------- 处理请求部分 -----------------

// http 服务 负责返回页面
var http = require('http');
var url= require('url');
var path= require('path');
var fs= require('fs');
var path=require('path');

var httpServer = http.createServer(function(request,response){
    var pathname = url.parse(request.url).pathname;
    var realPath = path.join("./", pathname);
    console.log( request.url , pathname , realPath );
    fs.exists( realPath , function(exists){
        if ( !exists ){
            response.writeHead(404, {
                'Content-Type': 'text/html'
            });
            response.write("This request URL " + pathname + " was not found on this server.");
            response.end();
        }else{
            fs.readFile(realPath, "binary", function (err, file) {
                if (err) {
                    response.writeHead(500, {
                        'Content-Type': 'text/plain'
                    });
                    response.end(err);
                } else {
                    response.writeHead(200, {
                        'Content-Type': "text/html"
                    });
                    response.write(file, "binary");
                    response.end();
                }
            });
        }
    })

});
httpServer.listen(1233);

console.log("Server running at port: 1233");




// websock 服务 负责处理消息
var WebSocketServer = require('ws').Server;
var ws = new WebSocketServer({
    port: 1234,//监听的端口
});

console.log("ws start on http://172.0.0.1:1234")

ws.on('connection',
function(wsocket,request) {

    // 如果已有两个玩家则拒绝加入
    if ( customers.length === 2 ){
        wsocket.terminate()
    }

    // 收到客户端请求时 给他起一个名字 保存起来
    var customer = {
        name : `player${customerCounter}`,
        hasAPartner : false ,
        ws : wsocket
    }
    customerCounter++ 
    
    wsocket.on('message',function( msg ){
        //对接收到的消息做些什么
        console.log("msg",msg)
        // wsocket.send("hihi client")
        msg = JSON.parse( msg );
        // 如果消息是关于战况 广播给其他在线的人
        if ( msg.action === "whatHappend" ){

            var whatHappendMsg = createMsg( msgType["aboutOthers"] , "whatHappend" , { who: msg.from , what: msg.data }) ;
            tellEveryoneExcept( msg.from , whatHappendMsg );

        }else if ( msg.action === "success" ){
            // 如果有人已通关
            // 告诉所有人winner是谁
            var winnerMsg = createMsg( msgType["aboutOthers"] , "someOneWin" , { winner : msg.from }) ;
            tellEveryoneExcept( "none" , winnerMsg );

        }
    });

    wsocket.on('close',function(){
        //连接关闭时做些什么
        console.log( customer.name , "closed" );
        // 在名单中去掉这个玩家
        customers = customers.filter( item => item.name != customer.name )
    });

    wsocket.on('error',function( err ){
        //连接出错时
        console.log( "error" , err );
    });



    console.log( customer.name + " connected!" );    

    // 将生成的名称返回给客户端
    var welcomeMsg = createMsg( msgType["aboutU"] , "giveAName" , customer.name ) ;
    wsocket.send( welcomeMsg );

    // 告诉客户端目前在线的其他玩家名称
    if ( customers.length > 0 ){
        var playersInfo = createMsg( msgType["aboutOthers"] , "players" , customers.map( item => item.name ) ) ;
        wsocket.send( playersInfo );
    }

    // 广播给所有在线的player xxx上线了
    var onlineMsg = createMsg( msgType["aboutOthers"] , "someOneIsOnline" , customer.name ) ;
    tellEveryoneExcept( customer.name , onlineMsg );

    // 将客户端的信息记录在名单里面
    customers.push( customer );   
    
    // 如果够2人 告诉所有人 开始比赛
    if ( customers.length > 1 ){
        var startMsg = createMsg( msgType["aboutOthers"] , "gamestart" , customers.map( item => item.name ) ) ;
        tellEveryoneExcept( "none" , startMsg );
    }

});
 


function tellEveryoneExcept( customerName  , msg ){
    console.log("tellEveryoneExcept",customers.length)
    customers.map( function(customer){
        if ( customer.name != customerName ){
            customer.ws.send(msg)
        }
    })
}


// 循环打印当前在线人数
setTimeout(function(){
    console.log("Current Online Users:",customers.length);
},1000*60)
