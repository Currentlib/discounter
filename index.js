//Documentation

//isExist(user_id) -- return true||false
//sendPage(user_id, share_name)  -- send current page to user
//replyKeyBoard(array_of_names)


//CONSTANTS

//Telegram
const TelegramBot = require("node-telegram-bot-api")
const bot = new TelegramBot('689031372:AAHKeAm_ggSd0v-yn8vwJcoi9am-rGproWs', {polling: true})


//DB
const low = require("lowdb")
const FileSync = require('lowdb/adapters/FileSync')
const adapter = new FileSync('db.json')
const db = low(adapter)

//parser
const osm = require("osmosis")

let urls = [{name: "Атб - Економія",
             url: "https://www.atbmarket.com/hot/akcii/economy/"},
            {name: "Атб - 7 днів",
             url: "https://www.atbmarket.com/hot/akcii/7day/"}]


//
//Telegram code
//

//On start function
//loadDefaultDataBase()
//On message function
bot.on('message', msg=>{
    if (msg.text == "/start") {
        bot.sendMessage(msg.chat.id, "Hello", replyKeyBoard(urls))
    } else if (msg.text == "parse") {
        console.log("Parse")
        parse()
    } else {
        if (!isExist(msg.chat.id)) {
            increaseUnique()
            addUser(msg.chat.id, msg.text)
        }
        increaseEveryMessage()
        resetUser(msg.chat.id, msg.text)
        sendPage(msg.chat.id, msg.text)
    }
})

bot.on("callback_query", query=>{
    if (query.data == "left") {
        decreasePage(query.from.id)
    } else if (query.data == "right") {
        increasePage(query.from.id)
    }
    let user = getUser(query.from.id)
    //console.log(query)
    let text = getPage(user.share, user.page)
    console.log(query.message.chat.id)
    bot.editMessageText(text, {chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: "Markdown", disable_web_page_preview: false, reply_markup: JSON.stringify(inlineKeyboard(query.from.id))})
    bot.answerCallbackQuery(query.id, '')
})



function sendPage(id, txt) {
    let user = getUser(id)
    console.log(user)
    let page = getPage(txt, user.page)
    bot.sendMessage(id, page, {parse_mode: "Markdown", disable_web_page_preview: false, reply_markup: JSON.stringify(inlineKeyboard(id))})
}

function replyKeyBoard(arr) {
    //console.log(arr)
    let newArr = []
    arr.map((cur) => {
        console.log("zz")
        newArr.push([{text: cur.name}])
    });
    console.log(newArr)
    let keys;
    let keyboard;
    keys = JSON.stringify({
    keyboard: newArr,
        resize_keyboard: true
    });
    keyboard = {reply_markup: JSON.parse(keys)};
    return keyboard
}

function inlineKeyboard(id) {
    let user = getUser(id)
    let key = []
    if (user.page == 0) {
        key = [[{text: "\u27A1", callback_data: "right"}]]
    } else if (user.page == getPagesCount(user.share)-1) {
        key = [[{text: "\u2B05", callback_data: "left"}]]
    } else {
        key = [[{text: "\u2B05", callback_data: "left"}, {text: "\u27A1", callback_data: "right"}]]
    }
    let keys = {
        inline_keyboard: key
    }
    return keys
  }

//
//Parser code
//

function parse() {
    refreshDataBase()
    urls.map((cur, i)=>{
        let shares = parser(cur.url)
        setTimeout(()=>{
            console.log("parser")
            pushShare(cur.name, shares)
        }, 6000)
    })
}


function getPage(name, page) {
    let shares = db.get("shares").find({name: name}).value()
    return shares.allShares[page]
}

function getPagesCount(share) {
    let obj = db.get("shares").find({name: share}).value()
    return obj.allShares.length
}

function pushShare(name, shares) {
    let sharesOnPages = []
    let pageCounter = 1
    let page = ""
    shares.map((cur, i)=>{
        page+=cur
        if ((i+1)%10==0 || i==(shares.length-1)) {
            page+="*[" + pageCounter + "/" + Math.ceil(shares.length/10) +"]*"
            sharesOnPages.push(page)
            page = ""
            pageCounter++
        }
    })
    db.get("shares").push({name: name, allShares: sharesOnPages}).write()
}

function parser(url) {
    let parsed = []
    osm
    .get(url)
    .find('.promo_info')
    .set({
        "before": '.promo_info_text',
        "after": '.promo_info_text span',
        "eco": ".economy_price span",
        "priceBefore": ".promo_price",
        "priceAfter": '.promo_price span',
        "cur": ".currency",
        "old": ".promo_old_price"
    })
    //
    .data(function(data){
        let obj = {"before" : data.before.split('\n')[0],
        "after": data.after,
        "eco": data.eco || "0%",
        "priceBefore": data.priceBefore.split("\n")[0].substring(0, data.priceBefore.split("\n")[0].length - 2) + "." + data.priceAfter,
        "cur": data.cur,
        "old": data.old || data.priceBefore.split("\n")[0].substring(0, data.priceBefore.split("\n")[0].length - 2) + "." + data.priceAfter
    }
        if (obj.eco != "0%") {
            parsed.push(`*${obj.before}*` + " " + obj.after + " " + "\n" + `_Було: ${obj.old}${obj.cur} Стало: ${obj.priceBefore}${obj.cur}_ *Знижка: ${obj.eco}*` + "\n\n")
        } else {
            parsed.push(`*${obj.before}*` + " " + obj.after + " " + "\n" + `_Ціна: ${obj.old}${obj.cur}_` + "\n\n")
        }
    })
    return parsed
}

//
//DB code
//

//Check user in DB
function isExist(id) {
    if (db.get("users").find({id: id}).value()) {
        return true
    }
    return false
}

function decreasePage(id) {
    db.get("users").find({id: id}).update("page", n=>n-1).write()
}

function increasePage(id) {
    db.get("users").find({id: id}).update("page", n=>n+1).write()
}

function addUser(id, share) {
    db.get("users").push({id: id, page: 0, share: share}).write()
}

function getUser(id) {
    return db.get("users").find({id:id}).value()
}

function resetUser(id, share) {
    db.get("users").find({id: id}).assign({page: 0, share: share}).write()
}

function refreshDataBase() {
    db.assign({ shares: []}).write()
}

function increaseUnique() {
    db.get("stat").update("uniqueUsers", n=>n+1).write()
}

function increaseEveryMessage() {
    db.get("stat").update("everyMessage", n=>n+1).write()
}

function loadDefaultDataBase() {
    db.defaults({ users: [], shares: [], stat: {
        everyMessage: 0,
        uniqueUsers: 0
    }})
    .write()
}