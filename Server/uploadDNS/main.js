var router = require('request-promise');
var dnspod = require('request-promise');
var querystring = require('querystring');
var moment = require('moment');
var args = process.argv.splice(2);

let ips = {
    telecom: args[1],
    unicom: args[0]
};
console.log(getDate() + "starting node ip sync to dns.");
syncIp().then(()=>{
    console.log(getDate() + "ip sync is done.")
}).catch((reason) =>{
    console.error(getDate() + "ip sync failure, because " + reason);
});


// setInterval(function(){
//     console.log("starting ip sync.");
//     syncIp().then(()=>{
//         console.log("ip sync is done.")
//     }).catch((reason) =>{
//         console.log("ip sync failure, because " + reason);
//     });
// }, 300000);

function getDate(){
    let date = new Date();
    return "[" + moment(date).format("YYYY-MM-DD HH:mm:ss") + "] ";
}

async function loginRouter(){
    let routerOpt = {
        url: "http://router.jcdev.cc:8888/cgi-bin/luci/;stok=/login?form=login",
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Referer": "http://router.jcdev.cc:8888/webpages/login.html",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: querystring.stringify({
            "data": '{"method":"login","params":{"username":"admin","password":"6e84923fb45013217b1118a7b71c2455bf8d46a81eae11a77f525b8b1d841d9ab0b7353840923ee2f244d65181fb49b79f0bdf761bdc05c17656c29ab9e9b60fc1b897d966de1d9f0a9d53e74eac10b5733d25b69164f9a0fada1e5d4c1b49ab95572f35fce65f647e607ecfc10bc8fafef8472952490c4a5ef876c8796a51a6"}}'
        })
    };

    let loginInfo = {
        "stok": "",
        "opt": routerOpt
    };
    
    console.log("getting stok from router..");
    try{
        let result = await router(routerOpt, function(err,res,body){
            loginInfo.opt.headers.Cookie = res && res.headers["set-cookie"];
        });
        result = JSON.parse(result);
        if(result.error_code != "0") return Promise.reject("password validation error!"); 

        loginInfo.stok = result.result.stok;
        loginInfo.opt.url = "http://router.jcdev.cc:8888/cgi-bin/luci/;stok=" + loginInfo.stok + "/admin/system_state?form=system_state";
        loginInfo.opt.body = querystring.stringify({"data": '{"method":"get"}'});
        console.log("stok no. is :" + loginInfo.stok);
        return Promise.resolve(loginInfo);
    }
    catch(err)
    {
        return Promise.reject(err.message);
    }
};

async function getIpFromRouter(stok, opt){
    console.log("getting ip address from router..");
    try{
        let ips = {};
        let result = await router(opt);
        result = JSON.parse(result);
        if (result.error_code != "0") return Promise.reject("error for getting ips");

        let normal = result.result[0].normal;
        ips.telecom = normal[0].ipaddr;
        ips.unicom = normal[1].ipaddr;
        console.log("ip address is " + JSON.stringify(ips));
        return Promise.resolve(ips);
    } catch(err) {
        return Promise.reject(err.message);
    }
}

async function syncIp() {
    try {
        // let info = await loginRouter();
        // let ips = await getIpFromRouter(info.stok, info.opt);
        let ipsDns = await getIpFromDns();
        if (ips.telecom != ipsDns.telecom.value) {
            //更新电信数据
            console.log(getDate() + "uploading telecom host ip to dns ..");
            await uploadIps(ips.telecom, ipsDns.telecom.id, "home", "0", "A");
            console.log(getDate() + "uploaded telecom host ip to dns ..");
        } 
        else {
            console.log(getDate() + "do not need to sync telecom ip address.");
        }

        if (ips.unicom != ipsDns.unicom.value) {
            //更新联通数据
            console.log(getDate() + "uploading unicom host ip to dns ..");
            await uploadIps(ips.unicom, ipsDns.unicom.id, "home", "10=1", "A");
            console.log(getDate() + "uploaded telecom host ip to dns ..");
        }
        else {
            console.log(getDate() + "do not need to sync unicom ip address.");
        }
    } catch (err) {
        return Promise.reject(err);
    }
}

async function getIpFromDns() {
    let opt = {
        "url": "https://dnsapi.cn/Record.List",
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: querystring.stringify( {
            "login_token": "90628,fe6a1f18839f83dc56d3472f27cbdd23",
            "format": "json",
            "domain": "jcdev.cc",
            "sub_domain": "home"
        }),
    };

    console.log(getDate() + "getting host ip from DNS ...");
    try {
        let result = await dnspod(opt);
        let ips = {
            "telecom" : {},
            "unicom" : {}
        }
        result = JSON.parse(result);
        if (result.status.code != "1") { return Promise.reject(result.status.message); }

        for (i = 0; i < result.records.length; i++) {
            switch (result.records[i].remark) {
                case "电信": 
                    console.log(getDate() + "telecom host ip in DNS is " + result.records[i].value);
                    ips.telecom = result.records[i];
                    break;
                case "联通": 
                    console.log(getDate() + "unicom host ip in DNS is " + result.records[i].value);
                    ips.unicom = result.records[i];
                    break;
            }
        }

        return Promise.resolve(ips);
    } catch( err ) {
        return Promise.reject(err.message);
    }
}

async function uploadIps(ip, id, name, line_id, type){
    let opt = {
        "url": "https://dnsapi.cn/Record.Modify",
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    };
    let data = {        
        "login_token": "90628,fe6a1f18839f83dc56d3472f27cbdd23",
        "format": "json",
        "domain": "jcdev.cc",
        "record_id": id,
        "record_line_id": line_id,
        "record_type": type,
        "sub_domain": name,
        "value": ip
    };

    opt.body = querystring.stringify(data);
    try {
        let result = await dnspod(opt);
        result = JSON.parse(result);
        if (result.status.code != "1") { return Promise.reject(result.status.message); }
        else return Promise.resolve(result.status.message);
    } catch( err ) {
        return Promise.reject(err.message);
    }
}

