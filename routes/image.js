var express = require('express');
var router = express.Router();

const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");
const fs = require("fs");
//非同期fs
const asyncfs = require("fs").promises;
//ヘッドレスブラウザ
const puppeteer = require("puppeteer");
const path = require("path");
//ファイルの追加を検知する
const chokidar = require("chokidar");
//画像があるディレクトリ
const imageDir = "./private/confidential/for_image";

const sqlite3 = require('sqlite3');
// プロジェクトのルートディレクトリを基準に絶対パスを作成
const dbPath = path.join(__dirname, '../private/mydb.db');
// データベースに接続
const db = new sqlite3.Database(dbPath);
db.run(`
    CREATE TABLE IF NOT EXISTS image(
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT,
        "dir" TEXT unique,
        "cover" TEXT,
        "createdAt" datetime default (datetime('now','+9 hours'))
    )
  `);

//indexに表示するディレクトリをデータベースに登録
(async () => {
    try {
        await makeList();
    } catch (err) {
        //console.log(err);
    }
})();

async function makeList() {
    //ディレクトリ名取得
    const files = await asyncfs.readdir(imageDir);
    for (const file of files) {
        var dir = imageDir + "/" + file;
        const stat = await asyncfs.stat(dir);
        //ディレクトリでなかったら処理を飛ばす
        if (!stat.isDirectory()) continue;
        var cover;
        const file2 = await asyncfs.readdir(dir)
        //ディレクトリ内の最初の画像を取得
        cover = dir + "/" + file2.sort()[0];
        //データベースに登録
        var name = file;
        db.serialize(() => {
            db.run('insert or ignore into image (name,dir,cover) values (?,?,?)', name, dir, cover, (err) => {
                if (err) console.log(err);
            });
        });
    };
}

//トップページはURL入力と画像タイル表示
router.get('/', async function (req, res, next) {
    db.serialize(() => {
        //新しい画像を上に表示
        db.all('select * from image order by dir desc', (err, rows) => {
            if (!err && rows != null) {
                //画像アクセス用のリンクに置換
                const updatedRows = rows.map(row => {
                    return {
                        ...row, // 既存のプロパティを保持
                        dir: row.dir.replace('./private/confidential/for_image', '/image/show'), // dir を置換
                        cover: row.cover.replace('./private/confidential/for_image', '/image/file')
                    }
                });
                var data = {
                    content: updatedRows //取得したレコードデータ
                };
                res.render('image/index', data);
            } else {
                console.error(err);
            }
        });
    });
});

//urlが送られてきたとき
router.post('/get', async function (req, res, next) {
    //フォームから送られたデータ
    const form_url = req.body.getUrl;
    const form_flag = req.body.valFlag;
    const form_start = req.body.startNum;
    const form_end = req.body.endNum;
    const form_update = req.body.updateTime;

    // デバッグ用にURLをログ出力
    console.log('Received URL:', form_url);

    //puppeteerで画像を読み込ませる場合
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    //保存するフォルダ名に使う現在時刻
    const now = new Date();
    // UTCから日本時間に変換（UTC+9）
    now.setHours(now.getHours() + 9);
    const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, ''); // ISO形式を整形
    //path.joinをwindowsで実行すると/じゃなくて\になって画像読み込む際にエラーでた
    const saveDirectory = path.posix.join(imageDir, timestamp);
    if (!fs.existsSync(saveDirectory)) {
        //保存する画像をいれるフォルダを作成
        fs.mkdirSync(saveDirectory);
    }


    //先にindexにリンクを作っておく。後で表紙は取得してデータベースに登録する。
    //loadingの画像を仮表示
    //データベースに登録
    var name = timestamp;
    //path.joinすると"./"が消える
    var dir = "./" + saveDirectory;
    var cover = "/image/file/loading.jpg";
    //名前とパスをデータベースに追加
    db.serialize(() => {
        db.run('insert into image (name,dir,cover) values (?,?,?)', name, dir, cover, (err) => {
            if (err) console.log(err);
        });
    });

    //画像ダウンロード
    if (form_flag == "ON") {
        //URLに変数を入れて連番に対応
        for (let i = form_start; i <= form_end; i++) {
            const url_i = form_url.replace("{num}", i);
            console.log(url_i);
            await getImage(page, url_i, saveDirectory);
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            await delay(form_update * 1000);
        }
    } else {
        //サイトから画像保存
        console.log(form_url);
        await getImage(page, form_url, saveDirectory);
    }
    //データベースに表紙を登録。ディレクトリ内の最初の画像に更新
    const files = fs.readdirSync(dir);
    cover = dir + "/" + files.sort()[0];
    //データベースに追加
    db.serialize(() => {
        db.run('update image set cover = ? where dir = ?', cover, dir, (err) => {
            if (err) console.log(err);
        });
    });

    //読み込み完了
    console.log('Files loaded:');
    // ブラウザを閉じる
    await browser.close();
});

//サイトから画像を保存する関数
async function getImage(page, url, saveDir) {
    const listener = async (response) => {
        const resUrl = response.url();
        const fileName = resUrl.split('/').pop().split('?')[0]; // ファイル名を取得
        const extension = fileName.split('.').pop(); // 拡張子を取得
        const now = new Date();
        // UTCから日本時間に変換（UTC+9）
        now.setHours(now.getHours() + 9);
        const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, ''); // ISO形式を整形
        var filePath = path.join(saveDir, timestamp + "." + extension);
        if (fileName && /\.(jpg|jpeg|png|webp|avif)$/i.test(fileName)) {
            try {
                const buffer = await response.buffer();
                //ファイル名が重複していたらaを追加
                //while (fs.existsSync(filePath)) {
                while (true) {
                    try {
                        await asyncfs.access(filePath);
                        const d = path.dirname(filePath);
                        const e = path.extname(filePath);
                        //bはファイル名で拡張子は除く
                        const b = path.basename(filePath, e);
                        filePath = path.join(d, b + "a" + e); // 再度ファイル名を生成
                        console.log("保存するタイミングがほぼ同時でファイル名が被りました。aを追加して重複を避けます。");
                        console.log("filePath", filePath);
                    } catch {
                        break;
                    }
                }
                //ファイルとして保存
                //fs.writeFileSync(filePath, buffer);
                await asyncfs.writeFile(filePath, buffer);
                console.log(`Saved: ${fileName}`);
            } catch (err) {
                console.error(`Failed to save ${fileName}: ${err.message}`);
            }
        }
    };
    page.on("response", listener);
    await page.goto(url, { waitUntil: 'networkidle0' });
    page.off("response", listener);
}

//画像を送る
router.get("/file/*", (req, res, next) => {
    const fn = req.params[0];
    const fpath = path.join(__dirname, "../private/confidential/for_image", fn);
    res.sendFile(fpath, (err) => {
        if (err) {
            //console.error(err);
            //画像が存在しない場合はエラーを返さないとブラウザがずっとグルグルする
            res.status(err.status).end();
        }
    });
});

//画像がクリックされたとき
router.get("/show/*", async (req, res, next) => {
    const dirName = req.params[0];
    const dir = path.join(imageDir, dirName);
    const files = (await asyncfs.readdir(dir)).sort();
    const updatedFiles = files.map(file => {
        return path.join("/image/file", dirName, file);
    });
    var data = {
        files: updatedFiles, //取得したレコードデータ
        dir: dirName//SSE用
    };
    res.render("image/show", data);
});


//showにSSEで画像パスを送る
router.get("/show_sse/*", async (req, res, next) => {
    //SSEで送るためのヘッダ設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    //監視するディレクトリ
    const dirName = req.params[0];
    const dir = path.join(imageDir, dirName);
    const watcher = chokidar.watch(dir, {
        ignoreInitial: true, //最初の既存ファイルのイベントは無視
        persistent: true
    })
    //ファイルが追加されたときEESで送る
    watcher.on('add', (path) => {
        console.log(`File: ${path} has been added`);
        //const rep = path.replace('private\\confidential\\for_image', '\\image\\file');
        const rep = path.replace(/private[\/\\]confidential[\/\\]for_image/g, '/image/file');
        console.log("置換後のリンク", rep);
        var data = {
            files: rep //取得したレコードデータ
        }
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
});

//indexにSSEでデータベースのデータを送る
router.get("/index_sse", async (req, res, next) => {
    //SSEで送るためのヘッダ設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const watcher = chokidar.watch(imageDir, {
        ignoreInitial: true, //最初の既存ファイルのイベントは無視
        persistent: true
    })
    //ディレクトリが追加されたときを検知
    watcher.on('addDir', (path) => {
        console.log(`Directory: ${path} has been added`);
        //データベースからディレクトリを検索
        db.all('select * from image where dir = ?', "./"+path, (err, rows) => {
            if (!err && rows != null) {
                //画像アクセス用のリンクに置換
                const updatedRows = rows.map(row => {
                    return {
                        ...row, // 既存のプロパティを保持
                        dir: row.dir.replace('./private/confidential/for_image', '/image/show'), // dir を置換
                        cover: row.cover.replace('./private/confidential/for_image', '/image/file')
                    }
                });
                //追加されたディレクトリの情報をSSEで送る
                res.write(`data: ${JSON.stringify(updatedRows[0])}\n\n`);
            } else {
                console.error(err);
            }
        });
    });
});

//idを受け取りタイルを削除する
router.post("/delete_tile", async (req, res, next) => {
    const id = req.body.id;
    db.serialize(() => {
        db.get('select * from image where id = ?', id, (err, row) => {
            if (!err && row != null) {
                //ディレクトリを削除
                const dir = row.dir;
                fs.rm(dir, { recursive: true },(err)=>{
                    if(err) console.log(err);
                });
                //データベースから削除
                db.run('delete from image where id = ?', id, (err) => {
                    if (err) console.log(err);
                });
                //削除完了を知らせる
                res.send("削除しました");
            } else {
                console.error(err);
            }
        });
    });
});

module.exports = router;
