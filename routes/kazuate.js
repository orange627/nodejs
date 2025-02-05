var express = require('express');
var router = express.Router();
const routerURL='kazuate';
//ルームデータ
class Room{
    constructor(name){
        this.name=name;
        this.players=[];
        this.currentPlayer='';
        this.GameState='setting';//setting, decide, guess
        this.message='自分の数字を決めてください';
        this.player_info={};
        /*
        name-g: 推測された数字
        name-d: 自分の数字を決めたどうか
        name-w: win, lose
        name-s: 負けた時に自分の番号を公開する
        */
        this.chat=[];
        this.lastCell={row:-1,col:-1};
        this.newCell={row:-1,col:-1};
    }
    addPlayer(player){
        if ((this.GameState=='setting'||this.GameState=='decide')||this.players.includes(player)) {
            if(!this.players.includes(player))this.players.push(player);
            return true;
        } else {
            console.log('Cannot add more players.');
            return false;
        }
    }
    removePlayer(player){
        console.log(player+"がリストにいるか調べます。");
        console.log("現在のリストは以下のとおりです。:"+this.players);
        if (this.players.includes(player)) {
            this.players = this.players.filter(p => p !== player);
            if (this.players.length === 0) {
                delete rooms[this.name]; // ルームが空になったら削除
            }
            console.log("プレイヤー{"+player+"}を削除しました。");
        }
    }
    deleteRoom(){
        delete rooms[this.name];
    }
    //ルームを3時間後に自動で消すタイマー
    startDeleteTimer(timer){
        timer = setTimeout(() => {
            console.log(`ルーム ${this.name} を削除します`);
            delete rooms[this.name];
        }, 3 * 60 * 60 * 1000); // 3時間 (3 * 60 * 60 * 1000ミリ秒)
    }
}
//ルーム情報保管
const rooms={};
//update_sse_res保管
const update_sse_res = {};
//timerも循環参照を含むからjson出遅れないため別変数で管理。ルームを3時間で自動削除するためのタイマー。
const deletetimer = {};
//数あての各自の数字。クライアントに渡さないため別変数で管理。
const secretNumber={};

/* GET home page. */
router.get('/', function(req, res, next) {
    if(check(req,res))return;
    console.log(req.session.message);
    var data={
        title:'数当て',
        login:req.session.login,
        rooms:rooms,
        message:req.session.message || ''
    }
    req.session.message=null;
    res.render(routerURL+'/index',data);
});

//ログインしてなかったらログインページに飛ばす
function check(req,res){
    if(req.session.login==null){
        req.session.back='/'+routerURL;
        res.redirect('/users/enter');
        return true;
    }else{
        return false;
    }
}


//ルームでゲーム
router.get('/:user',(req,res,next)=>{
    //ログインしてなかったらログインページに飛ばす
    if(check(req,res))return;
    const user=req.params.user;
    const login_user=req.session.login.name;
    if(rooms[user]==null){
        //ルームがなかったら作る
        rooms[user]=new Room(user);
        //ルーム主をリストに追加
        rooms[user].addPlayer(login_user);
        //ルーム自動削除タイマー起動
        rooms[user].startDeleteTimer(deletetimer[user]);
    }else{
        //ルームが存在する場合、ルームに入る
        if(!rooms[user].addPlayer(login_user)){
            req.session.message="そのルームはすでに満員のようです。";
            res.redirect('/'+routerURL);
        }
    }
    var data={
        title:'数当て',
        login:req.session.login,
        room:rooms[user]
    }
    res.render(routerURL+'/game',data);

});

//データ更新
router.post('/:room/update',(req,res,next)=>{
    const room=req.params.room;
    //値のコピー
    Object.assign(rooms[room],req.body.data);
    const value=req.body.value;
    const name=req.body.name;
    const digit=rooms[room].player_info['digit-num'];//桁数
    //勝敗判定(手番はすでに次の番になっている)
    switch(rooms[room].GameState){
        case 'setting':
            if(value=='')break;
            rooms[room].player_info['digit-num']=value;
            rooms[room].GameState='decide';
            console.log('桁数が'+value+'に設定されました。');
            break;
        case 'decide':
            if(value.length!=digit||!/^\d+$/.test(value))break;
            if(secretNumber[name]==null){
                secretNumber[name]=value;//各自の数字を保管。ルーム削除時に消す！！
                if(!rooms[room].player_info['decide-num'])rooms[room].player_info['decide-num']=0;
                rooms[room].player_info['decide-num']++;
            }
            console.log(secretNumber);
            console.log(rooms[room].player_info['decide-num']);
            //全員数字を決めたら
            if(rooms[room].player_info['decide-num']==rooms[room].players.length){
                rooms[room].GameState='guess';
                rooms[room].currentPlayer=rooms[room].players[0];
            }
            break;
        case 'guess':
            if(rooms[room].currentPlayer==name){
                var loseNum=0;
                //みんなの数字を判定する
                rooms[room].players.forEach((p)=>{
                    //最初に配列として初期化
                    if (!rooms[room].player_info[p + '-g']) {
                        rooms[room].player_info[p + '-g'] = [];
                    }
                    if(p==name){
                        if(value=='timeout'){
                            rooms[room].player_info[p+'-g'].push('timeout');
                        }else{
                            rooms[room].player_info[p+'-g'].push('guess');
                        }
                    }else{
                        if(value!='timeout'){
                            //他の人の推測された結果
                            var result = judge(secretNumber[p], value);
                            var guessNum = value + '&nbsp;&nbsp;&nbsp;' + result.numXpos + ',' + result.numXNpos;
                            rooms[room].player_info[p+'-g'].push(guessNum);
                            //4,0で数字を当てられた場合
                            if(result.numXpos==rooms[room].player_info['digit-num']){
                                rooms[room].player_info[p+'-w']='lose';
                                rooms[room].player_info[p+'-s']=secretNumber[p];
                            }
                        }else{
                            rooms[room].player_info[p+'-g'].push('-');
                        }
                    }
                    //loseの人数を数える
                    if(rooms[room].player_info[p+'-w']=='lose')loseNum++;
                });
                //勝敗判定
                if(loseNum==rooms[room].players.length-1){
                    rooms[room].players.forEach((p)=>{
                        console.log('各プレイヤーの状態['+p+']'+rooms[room].player_info[p+'-w']);
                        if(rooms[room].player_info[p+'-w']!='lose'){
                            rooms[room].player_info[p+'-w']='win';
                            rooms[room].player_info['result']=p+'の勝利です';
                            rooms[room].player_info[p+'-s']=secretNumber[p];
                        }
                        rooms[room].GameState='end';
                    });
                }
                //勝負がついていない場合は次の人のターンにする
                var index=rooms[room].players.indexOf(rooms[room].currentPlayer);
                while(rooms[room].GameState!='end'){
                    var max=rooms[room].players.length;
                    var next=(index+1)%max;
                    var nextP=rooms[room].players[next];
                    if(rooms[room].player_info[nextP+'-w']!='lose'){
                        rooms[room].currentPlayer=nextP;
                        break;
                    }else{
                        index=next;
                    }
                }
            }
            break;
        case 'end':
            break;
    }
    // SSEでクライアントに更新を送信
    if (update_sse_res[room]) {
        update_sse_res[room].forEach(client => {
            client.write(`data: ${JSON.stringify(rooms[room])}\n\n`);
        });
    }
    res.sendStatus(204);
});

//判定関数
function judge(ans,guess){
    var numXpos=0;
    var numXNpos=0;
    var check = new Array(ans.length).fill(false);
    //数字と位置があっている
    for (let i = 0; i < ans.length; i++) {
        if (ans[i] === guess[i]) {
            check[i]=true;
            numXpos++;
        }
    }
    //数字があっているが位置はあっていない
    //重複ありの場合は、答えに含まれている個数の中で回答する
    //1100が答えで、0111の予測の場合は1,2とはならず、1,1となる。
    for (let i = 0; i < ans.length; i++) {
        //位置があっていない場合
        if (ans[i] !== guess[i]) {
            //残りの位置があっていないが数字があっているものを探す
            for (let j = 0; j < ans.length; j++) {
                //すでにカウント済みの場合はcheck[j]がtrue
                if (ans[i] === guess[j]&&!check[j]) {
                    check[j]=true;
                    numXNpos++;
                    break;
                }
            }
        }
    }
    return { numXpos, numXNpos };
}

//ゲームのリセット
router.post('/:room/reset',(req,res,next)=>{
    try{
        const room=req.params.room;
        rooms[room].currentPlayer='';
        rooms[room].GameState='setting';
        rooms[room].player_info['decide-num']=0;
        delete rooms[room].player_info['digit-num'];
        rooms[room].players.forEach((player)=>{
            delete secretNumber[player];
            delete rooms[room].player_info[player+'-w'];
            delete rooms[room].player_info[player+'-g'];
            delete rooms[room].player_info[player+'-d'];
            delete rooms[room].player_info[player+'-s'];
            console.log('delete '+secretNumber[player]);
        });
        // SSEでクライアントに更新を送信
        if (update_sse_res[room]) {
            update_sse_res[room].forEach(client => {
            client.write(`data: ${JSON.stringify(rooms[room])}\n\n`);
        });
    }
    res.sendStatus(204);
    }catch(err){
        console.log(err);
    }
        
});

router.use(express.text()); // text/plainデータをパースするためのミドルウェア。beaconを使うために必要。
//ルームから退出。ルームの削除も
router.post('/:room/leave',(req,res,next)=>{
    const room=req.params.room;
    const leave_user=req.body;
    console.log(leave_user+"がルームから退出しました");
    //rooms[room].removePlayer(leave_user);
    res.status(204).end();
});
//ルーム削除
router.post('/:room/delete-room',(req,res,next)=>{
    const room=req.params.room;
    rooms[room].players.forEach((player)=>{
        delete secretNumber[player];
        console.log('delete '+secretNumber[player]);
    });
    // SSEでメンバーを追い出すメッセージを送信
    rooms[room].player_info['bye']='bye';
    if (update_sse_res[room]) {
        update_sse_res[room].forEach(client => {
        client.write(`data: ${JSON.stringify(rooms[room])}\n\n`);
    });}
    rooms[room].deleteRoom();
    res.status(204).end();
});
//sseで更新。プレイヤーの入室を伝える。
router.get('/:room/sse_load',(req,res,next)=>{
    const room=req.params.room;
    //相手プレイヤーの名前情報を参照できるようにする。最初の一手で自分と相手の色を決定するため。
    //rooms[room].player_info[rooms[room].players[0]+'-o']=rooms[room].players[1];
    //rooms[room].player_info[rooms[room].players[1]+'-o']=rooms[room].players[0];
    // SSEでクライアントに更新を送信
    if (update_sse_res[room]) {
        update_sse_res[room].forEach(client => {
            client.write(`data: ${JSON.stringify(rooms[room])}\n\n`);
        });
    }
    res.status(204).end();
});

//SSEでゲームを更新
router.get("/:room/update_sse", async (req, res, next) => {
    //SSEで送るためのヘッダ設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const room=req.params.room;

    //res.writeは変数に保存してupdateから実行    
    if(!update_sse_res[room]){
        update_sse_res[room]=[];
    }
    if (update_sse_res[room]&&!update_sse_res[room].includes(res)) {
        update_sse_res[room].push(res);
    }
});

// チャットメッセージを受け取るエンドポイント
router.post('/:room/chat', (req, res,next) => {
    const room = req.params.room;
    const { user, message } = req.body;
    console.log(`${user}がメッセージを送信しました: ${message}`);
    rooms[room].chat.push({"user":user,"message":message});
    // SSEでクライアントに更新を送信
    if (update_sse_res[room]) {
        update_sse_res[room].forEach(client => {
            client.write(`data: ${JSON.stringify(rooms[room])}\n\n`);
        });
    }
    res.status(204).end();
});



module.exports = router;
