function cleanup() {
    this.reset();
}

cleanup.prototype.reset = function() {
    this.running = false;
    this.mids = [];
    this.midIndex = 0;
    if (this.timer) {
        clearInterval(this.timer);
    }
};

cleanup.prototype.cleanNextPage = function() {
    this.reset();
    this.running = true;

    const url = 'https://weibo.com/' + $CONFIG.user.profile_url;
    let http = new XMLHttpRequest();
    http.open('GET', url, true);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.send();

    var _this = this;
    http.onreadystatechange = function() {
        if (http.readyState != 4 || http.status != 200) {
            return;
        }

        let matches = http.responseText.match(/mid=([0-9]+)/g);
        if (matches == null) {
            _this.stop("恭喜你！\n如有漏网，请再执行一遍");
            return;
        }
        
        let values = {};
        matches.forEach(function(match) {
            values[match.substr(4)] = 0;
        }, this);

        _this.mids = Object.keys(values);
        _this.timer = setInterval(function() {
            _this.deleteNextWeibo();
        }, 1000);

        console.log('即将清理 ' + _this.mids.length + ' 条微博');
    }
};

cleanup.prototype.deleteNextWeibo = function() {
    if (this.midIndex < this.mids.length) {
        this.deleteWeibo(this.mids[this.midIndex]);
        this.midIndex++;
        return;
    }

    var _this = this;
    setTimeout(function () {
        _this.cleanNextPage();
    }, 1000);
};

cleanup.prototype.deleteWeibo = function(mid) {
    http = new XMLHttpRequest();
    http.open('POST', 'https://weibo.com/aj/mblog/del?ajwvr=6', true);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.send('mid=' + mid);
    http.onreadystatechange = function() {
        if (http.readyState != 4 || http.status != 200) {
            return;
        }

        try {
            const json = JSON.parse(http.responseText);
            if (json.code == 100000) {
                console.log('清理 [' + mid + ']');
            }
        } catch (error) {
            return;
        }
    }
};

cleanup.prototype.stop = function(message) {
    console.log(message);
    this.running = false;
    clearInterval(this.timer);
};

cleanup.prototype.start = function() {
    if (this.running) {
        console.log('正在进行中, 请稍后或者刷新页面后再执行.');
        return;
    }

    console.log("𝕎𝕖𝕚𝕓𝕠 𝕊𝕥𝕒𝕣𝕥 𝕆𝕧𝕖𝕣 v1.1\n开始执行");
    this.cleanNextPage();
};
