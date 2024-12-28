var express = require('express');
var router = express.Router();

//ルームデータ
class Room{
    constructor(name){
        this.name=name;
        this.players=[];
        this.state='waiting';
    }
    addPlayer(player){
        this.players.push(player);
    }
}
const rooms={};
rooms['a']=new Room('a');
rooms['a'].addPlayer('a');
rooms['a'].addPlayer('b');
rooms['c']=new Room('c');
rooms['c'].addPlayer('c');
rooms['c'].addPlayer('d');
/* GET home page. */
router.get('/', function(req, res, next) {
    if(check(req,res))return;
    var data={
        title:'五目並べ',
        login:req.session.login,
        rooms:rooms
    }
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
    var data={
        title:'五目並べ',
        login:req.session.login,
        rooms:rooms
    }
    res.render('gomoku/game',data);

});


module.exports = router;
