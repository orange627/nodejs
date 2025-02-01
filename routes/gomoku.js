var express = require('express');
var router = express.Router();
//いずれは自由に盤面サイズを変えられるようにしたい
const grid=15;
const gSize=50;
//ルームデータ
class Room{
    constructor(name){
        this.name=name;
        this.players=[];
        this.board=Array.from({ length: grid}, () => Array(grid).fill(null));
        this.currentPlayer='black';
        this.isGameOver=false;
        this.message='';
        this.player_info={};//name-c,name-w,c:color,w:winCount,o:opponentの名前
        this.chat=[];
        this.lastCell={row:-1,col:-1};
        this.newCell={row:-1,col:-1};
    }
    addPlayer(player){
        if (this.players.length < 2) {
            if(this.players[0]!=player)this.players.push(player);
            return true;
        } else {
            console.log('Cannot add more players. The game already has 2 players.');
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
//timerも循環参照を含むからjson出遅れないため別変数で管理
const deletetimer = {};

/* GET home page. */
router.get('/', function(req, res, next) {
    if(check(req,res))return;
    console.log(req.session.message);
    var data={
        title:'五目並べ',
        login:req.session.login,
        rooms:rooms,
        message:req.session.message || ''
    }
    req.session.message=null;
    res.render('gomoku/index',data);
});

//ログインしてなかったらログインページに飛ばす
function check(req,res){
    if(req.session.login==null){
        req.session.back='/gomoku';
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
            //ルームに二人すでに入っている場合
            req.session.message="そのルームはすでに満員のようです。";
            res.redirect('/gomoku');
        }
    }
    var data={
        title:'五目並べ',
        login:req.session.login,
        room:rooms[user]
    }
    res.render('gomoku/game',data);

});

//盤面データの取得
router.post('/:room/update',(req,res,next)=>{
    //盤面の更新
    const room=req.params.room;
    const row=req.body.row;
    const col=req.body.col;
    const color=req.body.color;
    //盤面に石を打つ
    rooms[room].board[row][col]=color;
    //置いた石の場所をハイライトするため保存
    rooms[room].lastCell = rooms[room].newCell;
    rooms[room].newCell = { row: row, col: col };

    rooms[room].isGameOver=req.body.isGameOver;
    rooms[room].message=req.body.message;
    //rooms[room].player_color=req.body.player_color;
    rooms[room].player_info=req.body.player_info;
    rooms[room].currentPlayer=req.body.currentPlayer;
    //勝利数の初期化
    if(rooms[room].player_info[rooms[room].players[0]+'-w']==null)rooms[room].player_info[rooms[room].players[0]+'-w']=0;
    if(rooms[room].player_info[rooms[room].players[1]+'-w']==null)rooms[room].player_info[rooms[room].players[1]+'-w']=0;
    //勝敗判定(手番はすでに次の番になっている)
    if(checkwin(rooms[room].board,row,col)){
        //勝負がついたとき
        rooms[room].isGameOver=true;
        if(rooms[room].player_info[rooms[room].players[0]+'-c']==rooms[room].currentPlayer){
            rooms[room].player_info[rooms[room].players[1]+'-w']++;
        }else{
            rooms[room].player_info[rooms[room].players[0]+'-w']++;
        }
    }
    // SSEでクライアントに更新を送信
    if (update_sse_res[room]) {
        update_sse_res[room].forEach(client => {
            client.write(`data: ${JSON.stringify(rooms[room])}\n\n`);
        });
    }
    res.sendStatus(204);
});

//盤面のリセット
router.post('/:room/reset',(req,res,next)=>{
        const room=req.params.room;
        rooms[room].board=Array.from({ length: grid}, () => Array(grid).fill(null));
        rooms[room].currentPlayer='black';
        rooms[room].isGameOver=false;
        rooms[room].lastCell=rooms[room].newCell;
        rooms[room].newCell={row:-1,col:-1};
        //rooms[room].player_color=['',''];
        rooms[room].player_info[rooms[room].players[0]+'-c']='';
        rooms[room].player_info[rooms[room].players[1]+'-c']='';
        // SSEでクライアントに更新を送信
        if (update_sse_res[room]) {
            update_sse_res[room].forEach(client => {
            client.write(`data: ${JSON.stringify(rooms[room])}\n\n`);
        });
    }
    res.sendStatus(204);
});

router.use(express.text()); // text/plainデータをパースするためのミドルウェア。beaconを使うために必要。
//ルームから退出。ルームの削除も
router.post('/:room/leave',(req,res,next)=>{
    const room=req.params.room;
    const leave_user=req.body;
    console.log(leave_user+"がルームから退出しました");
    rooms[room].removePlayer(leave_user);
    res.status(204).end();
});
//ルーム削除
router.post('/:room/delete-room',(req,res,next)=>{
    const room=req.params.room;
    rooms[room].removePlayer(rooms[room].players[0]);
    rooms[room].removePlayer(rooms[room].players[1]);
    res.status(204).end();
});
//sseで更新。プレイヤーの入室を伝える。
router.get('/:room/sse_load',(req,res,next)=>{
    const room=req.params.room;
    //相手プレイヤーの名前情報を参照できるようにする。最初の一手で自分と相手の色を決定するため。
    rooms[room].player_info[rooms[room].players[0]+'-o']=rooms[room].players[1];
    rooms[room].player_info[rooms[room].players[1]+'-o']=rooms[room].players[0];
    // SSEでクライアントに更新を送信
    if (update_sse_res[room]) {
        update_sse_res[room].forEach(client => {
            client.write(`data: ${JSON.stringify(rooms[room])}\n\n`);
        });
    }
    res.status(204).end();
});

//SSEで碁盤を更新
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

//勝敗判定
function checkwin(boardState,row,col){
    const directions=[
      {x:1,y:0},//横
      {x:0,y:1},//縦
      {x:1,y:1},//右上
      {x:-1,y:1}//左上
  ];
  for(const {x,y} of directions){
    const color=boardState[row][col];
    let count=1;
    //上半分の同じ色が並んでいる数
    for(let i=1;i<5;i++){
    //row,colがstring扱いだったから+付けた
      const newRow=+row+i*y;
      const newCol=+col+i*x;
      //盤面外や色が違う場合はbreak
      if(newRow<0||newRow>=grid||newCol<0||newCol>=grid||boardState[newRow][newCol]!==color){
        break;
      }
      count++;
    }
    //下半分
    for(let i=1;i<5;i++){
      const newRow=row-i*y;
      const newCol=col-i*x;
      //盤面外や色が違う場合はbreak
      if(newRow<0||newRow>=grid||newCol<0||newCol>=grid||boardState[newRow][newCol]!==color){
        break;
      }
      count++;
    }
    if(count>=5){
      return true;
    }
  }
  }

module.exports = router;
