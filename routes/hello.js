var express = require('express');
var router = express.Router();
var WebSocket=require('ws');

const sqlite3=require('sqlite3');
const { check,validationResult } = require('express-validator');
const db=new sqlite3.Database('mydb.db');

/* GET home page. */
// /helloのルートにアクセスしたときの処理
router.get('/', function(req, res, next) {
    db.serialize(()=>{
        db.all('select * from mydata',(err,rows)=>{
            if(!err){
                var data={
                    title:'Hello',
                    content:rows //取得したレコードデータ
                };
                res.render('hello/index',data);
            }
        });
    });
});

router.get('/add',(req,res,next)=>{
    var data={
        title: 'Hello/Add',
        content: '新しいレコードを入力',
        form: {name:'',mail:'',age:0}
    }
    res.render('hello/add',data);
});

router.post('/add',[check('name','NAMEは必ず入力してください。').notEmpty(),
    check('mail','MAILはメールアドレスを入力してください。').isEmail(),
    check('age','AGEは整数を入力してください').isInt()
],(req,res,next)=>{
    const errors=validationResult(req);

    if(!errors.isEmpty()){
        var result='<ul class="text-danger">';
        var result_arr=errors.array();
        for(var n in result_arr){
            result+='<li>'+result_arr[n].msg+'</li>';
        }
        result+='</ul>'
        var data={
            title: 'Hello/Add',
            content: result,
            form: req.body
        }
        res.render('hello/add',data);
    }else{
        const nm=req.body.name;
        const ml=req.body.mail;
        const ag=req.body.age;
        db.serialize(()=>{
            db.run('insert into mydata (name,mail,age) values (?,?,?)',nm,ml,ag);
        });
        res.redirect('/hello');
    }
});

router.get('/show',(req,res,next)=>{
    const id=req.query.id;
    db.serialize(()=>{
        const q='select * from mydata where id = ?';
        db.get(q,[id],(err,row)=>{
            if(!err){
                var data={
                    title: 'Hello/show',
                    content: 'id='+id+'のレコード:',
                    mydata: row
                }
                res.render('hello/show',data);
            }
        });
    });
});

router.get('/edit',(req,res,next)=>{
    const id=req.query.id;
    db.serialize(()=>{
        const q='select * from mydata where id = ?';
        db.get(q,[id],(err,row)=>{
            if(!err){
                var data={
                    title: 'hello/edit',
                    content: 'id='+id+'のレコードを編集',
                    mydata: row
                }
                res.render('hello/edit',data);
            }
        });
    });
});

router.post('/edit',(req,res,next)=>{
    const id=req.body.id;
    const nm=req.body.name;
    const ml=req.body.mail;
    const ag=req.body.age;
    const q='update mydata set name = ?, mail = ?, age = ? where id = ?';
    db.serialize(()=>{
        db.run(q,nm,ml,ag,id);
    });
    res.redirect('/hello');
});

router.get('/delete',(req,res,next)=>{
    const id=req.query.id;
    db.serialize(()=>{
        const q='select * from mydata where id = ?';
        db.get(q,[id],(err,row)=>{
            if(!err){
                var data={
                    title: 'hello/delete',
                    content: 'id='+id+'のレコードを削除',
                    mydata: row
                }
                res.render('hello/delete',data);
            }
        });
    });
});

router.post('/delete',(req,res,next)=>{
    const id=req.body.id;
    const q='delete from mydata where id = ?';
    db.serialize(()=>{
        db.run(q,[id]);
    });
    res.redirect('/hello');
});

router.get('/find',(req,res,next)=>{
    db.serialize(()=>{
        const q='select * from mydata';
        db.all(q,(err,row)=>{
            if(!err){
                var data={
                    title: 'hello/find',
                    content: '検索条件を入力してください',
                    mydata: row,
                    find: ''
                }
                res.render('hello/find',data);
            }
        });
    });
});

router.post('/find',(req,res,next)=>{
    var find=req.body.find;
    db.serialize(()=>{
        var q='select * from mydata where ';
        db.all(q+find,[],(err,rows)=>{
            if(!err){
                var data={
                    title: 'Hello/find',
                    find: find,
                    content: '検索条件'+find,
                    mydata: rows
                }
                res.render('hello/find',data);
            }
        });
    });
});

//websocketの接続テスト
const server=new WebSocket.Server({port: 3001});
server.on('connection',(ws)=>{
    ws.on('message',(msg)=>{
        console.log('Recieived:'+msg);
        ws.send('Echo:'+msg);
    });
    console.log('WebSocket server running on ws://localhost:3001');
})


module.exports = router;
