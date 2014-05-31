var UsageDataDetails = function () {
  this.Down = 0;
  this.Total = 0;
  this.Up = 0;
  
  this.__defineGetter__("DownPredicted", function () {
    return this.Down == 0 || this.DayNumber == 1 ? 0 : this.Down / parseInt(this.DayNumber - 1) * this.DaysInMonth;
  });
  
  this.__defineGetter__("UpPredicted", function () {
    return this.Up == 0 || this.DayNumber == 1 ? 0 : this.Up / parseInt(this.DayNumber - 1) * this.DaysInMonth;
  });

  this.__defineGetter__("TotalPredicted", function () {
    return this.Total == 0 || this.DayNumber == 1 ? 0 : this.Total / parseInt(this.DayNumber - 1) * this.DaysInMonth;
  });
  
  this.DayNumber = new Date().getDate();
  this.DaysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
};
 
var UsageData = function () {
    this.OffPeak = new UsageDataDetails();
    this.Peak = new UsageDataDetails();
    this.All = new UsageDataDetails();
};

var FoxSavvyTimer;
var FoxSavvy = function () {
  var that = this;
  
  this.onLoad = function() {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("foxsavvy-strings");
    
    // Listen for preference changes
    this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
         .getService(Components.interfaces.nsIPrefService)
         .getBranch("extensions.foxsavvy.");
    this.prefs.addObserver("", this, false);
  };
  
  this.observe = function(subject, topic, data) {
     if (topic != "nsPref:changed") { return; }
     
     clearTimeout(FoxSavvyTimer);
     this.RefreshUsage();
  };
  
  this.RefreshUsage = function() {
    // Get the Username / API Key preference
    var prefManager = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);
    this.APIKey = prefManager.getCharPref('extensions.foxsavvy.APIKey').trim();

    this.Usage = new UsageData();

    // Check which ISP we're requesting usage for -- order counts! If one does't match it falls through to the next, teksavvy is the catchall.
    if (/^[a-z0-9_\-\.]{3,}@(data\.com|ebox\.com|electronicbox\.net|highspeed\.com|internet\.com|ppp\.com|www\.com)$/.test(this.APIKey)) { 
        this.ISP = 'Electronicbox Residential DSL';
    } else if (/^[a-z0-9_\-\.]{3,}@ebox-business\.com$/.test(this.APIKey)) { 
        this.ISP = 'Electronicbox Business DSL';
    } else if (/^vl[a-z]{6}$/.test(this.APIKey)) {
        this.ISP = 'Videotron TPIA';
    } else if (/^[1-9]\d{4}$/.test(this.APIKey)) {
        // Valid logins are [a-z0-9]{3,20}@caneris (no .com on the end), but usage is retrieved by 5 digit account number.
        this.ISP = 'Caneris DSL'; 
    } else if (/^[A-Z0-9]{7}[A-F0-9]{11}D@(start\.ca)$/.test(this.APIKey)) {
        this.ISP = 'Start DSL';
        this.RefreshUsageStart();
    } else if (/^[A-Z0-9]{7}[A-F0-9]{11}C@(start\.ca)$/.test(this.APIKey)) {
        this.ISP = 'Start Cable';
        this.RefreshUsageStart();
    } else if (/^[A-Z0-9]{7}[A-F0-9]{11}W@(start\.ca)$/.test(this.APIKey)) {
        this.ISP = 'Start Wireless';
        this.RefreshUsageStart();
    } else if (/^[A-Z0-9]{7}[A-F0-9]{11}D@(logins\.ca)$/.test(this.APIKey)) {
        this.ISP = 'Start Wholesale DSL';
        this.RefreshUsageStart();
    } else if (/^[A-Z0-9]{7}[A-F0-9]{11}C@(logins\.ca)$/.test(this.APIKey)) {
        this.ISP = 'Start Wholesale Cable';
        this.RefreshUsageStart();
    } else if (/^[A-Z0-9]{7}[A-F0-9]{11}W@(logins\.ca)$/.test(this.APIKey)) {
        this.ISP = 'Start Wholesale Wireless';
        this.RefreshUsageStart();
    } else if (/^([0-9A-F]{32})(|@teksavvy.com)(|\+[0-9]{1,4})$/.test(this.APIKey)) {
        this.ISP = 'TekSavvy';
        this.RefreshUsageTekSavvy();
    } else {
        this.ISP = 'Invalid Username / API Key';
    }

    that.Usage.All.Down = that.Usage.Peak.Down + that.Usage.OffPeak.Down;
    that.Usage.All.Total = that.Usage.Peak.Total + that.Usage.OffPeak.Total;
    that.Usage.All.Up = that.Usage.Peak.Up + that.Usage.OffPeak.Up;  
    
    document.getElementById('lblCurrentUsageToolbar').value = parseFloat(this.Usage.Peak.Down).toFixed(2) + ' GB';
    document.getElementById('lblPredictedUsageToolbar').value = parseFloat(this.Usage.Peak.DownPredicted).toFixed(2) + ' GB';
    document.getElementById('lblISPToolbar').value = this.ISP;
    
    document.getElementById('lblCurrentUsageStatusbar').value = document.getElementById('lblCurrentUsageToolbar').value;
    document.getElementById('lblPredictedUsageStatusbar').value = document.getElementById('lblPredictedUsageToolbar').value;
    document.getElementById('lblISPStatusbar').value = document.getElementById('lblISPToolbar').value;
    
    FoxSavvyTimer = setTimeout("foxsavvy.RefreshUsage();", 30 * 60 * 1000); // 30 minutes
  };
  
  this.RefreshUsageStart = function() {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
        var OneGig = 1000 * 1000 * 1000; // This is how the Start usage checker does it
        
        var KeyPairs = this.responseText.split(',');
        // var KeyPairs = "DL=111111111111,UL=222222222222,TOTAL=333333333333,DLFREE=444444444444,ULFREE=555555555555,TOTALFREE=999999999999".split(',');
        
        for (var i = 0; i < KeyPairs.length; i++) {
            var KeyValue = KeyPairs[i].split('=');
            switch (KeyValue[0]) {
                case 'DL': that.Usage.Peak.Down = parseInt(KeyValue[1]) / OneGig; break;
                case 'DLFREE': that.Usage.OffPeak.Down = parseInt(KeyValue[1]) / OneGig; break;
                case 'TOTAL': that.Usage.Peak.Total = parseInt(KeyValue[1]) / OneGig; break;
                case 'TOTALFREE': that.Usage.OffPeak.Total = parseInt(KeyValue[1]) / OneGig; break;
                case 'UL': that.Usage.Peak.Up = parseInt(KeyValue[1]) / OneGig; break;
                case 'ULFREE': that.Usage.OffPeak.Up = parseInt(KeyValue[1]) / OneGig; break;
            }
        }
    };
    xhr.onerror = function () {
        // TODO
    };
    xhr.open('GET', 'http://www.start.ca/support/capsavvy?code=' + this.APIKey, false);
    xhr.send(null);
  };
  
  this.RefreshUsageTekSavvy = function() {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
        var Data = JSON.parse(this.responseText);
        // var Data = {
                     // "odata.metadata":"https://<serviceUrl>/Usage/$metadata#UsageSummaryRecords","value":[
                       // {
                         // "StartDate":"2014-01-01T00:00:00","EndDate":"2014-01-09T00:00:00","OID":"120000","IsCurrent":true,"OnPeakDownload":12.56,"OnPeakUpload":7.98,"OffPeakDownload":0.1,"OffPeakUpload":1.04
                       // },{
                         // "StartDate":"2014-01-01T00:00:00","EndDate":"2014-01-09T00:00:00","OID":"320000","IsCurrent":true,"OnPeakDownload":20.56,"OnPeakUpload":9.98,"OffPeakDownload":0.1,"OffPeakUpload":2.07
                       // },{
                        // "StartDate":"2014-01-01T00:00:00","EndDate":"2014-01-09T00:00:00","OID":"568000","IsCurrent":true,"OnPeakDownload":32.56,"OnPeakUpload":9.98,"OffPeakDownload":54.1,"OffPeakUpload":1.07
                       // },{
                        // "StartDate":"2014-01-01T00:00:00","EndDate":"2014-01-09T00:00:00","OID":"428000","IsCurrent":true,"OnPeakDownload":32.56,"OnPeakUpload":9.98,"OffPeakDownload":54.1,"OffPeakUpload":1.07
                       // }
                     // ]
                   // };
                    
        if (Data.value) {
          for (var i = 0; i < Data.value.length; i++) {
            that.Usage.Peak.Down += Data.value[i].OnPeakDownload;
            that.Usage.Peak.Up += Data.value[i].OnPeakUpload;
            that.Usage.Peak.Total += (that.Usage.Peak.Down + that.Usage.Peak.Up);
            that.Usage.OffPeak.Down += Data.value[i].OffPeakDownload;
            that.Usage.OffPeak.Up += Data.value[i].OffPeakUpload;
            that.Usage.OffPeak.Total += (that.Usage.OffPeak.Down + that.Usage.OffPeak.Up);
          }
        }
    };
    xhr.onerror = function () {
        // TODO
    };
    xhr.open('GET', 'https://api.teksavvy.com/web/Usage/UsageSummaryRecords?$filter=IsCurrent%20eq%20true', false);
    xhr.setRequestHeader('TekSavvy-APIKey', this.APIKey);
    xhr.send(null);
  };
};
var foxsavvy = new FoxSavvy();

window.addEventListener("load", function () { foxsavvy.onLoad(); }, false);

FoxSavvyTimer = setTimeout("foxsavvy.RefreshUsage();", 1000);