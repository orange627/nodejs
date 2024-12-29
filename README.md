# nodejs
nodejs超入門の本を読みながらチャットアプリを作成した。
自分で新たにサイトを追加していく。

package.jsonのscriptsにdockerのコマンドを記載したため、
npm run docker
でdocker compose up --buildが実行される。

privateフォルダを用意してngrokのtokenやデータベースをpublicリポジトリにpushしないようにした。
privateリポジトリのnodejs-privateの方にpushした。

異なるOSで実行する際にはsqliteのバイナリが異なるため、"npm rebuild sqlite3"を実行する必要がある。
