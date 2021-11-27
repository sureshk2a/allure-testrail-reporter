const axios = require('axios');

//This module reads data from allure-report and creates a TestRail run with it
class TestRailReporter {
    constructor(testRailUrl,testRailUsername,testRailAuthKey) {
      this.url = testRailUrl;
      this.username = testRailUsername;
      this.authkey = testRailAuthKey;
      this.authPayload = {
        auth: {
          username: testRailUsername,
          password: testRailAuthKey,
        },
      }
    }

    _validate(options, name) {
      if (options == null) {
          throw new Error("Missing testRailsOptions in wdio.conf");
      }
      if (options[name] == null) {
          throw new Error(`Missing ${name} value. Please update testRailsOptions in wdio.conf`);
      }
  }

    /**
     * Convert milliseconds to minutes and seconds for TestRail payload
     * @param millis
     */
    millisToStringifyMinutesAndSeconds(millis){
      var minutes = Math.floor(millis / 60000);
      var seconds = ((millis % 60000) / 1000).toFixed(0);
      if(minutes==0){
        if(seconds==0){ return "0" }
        return Math.floor(seconds)+"s";
      }else if(seconds==0){
        return Math.floor(minutes)+"m"
      }else{
        return Math.floor(minutes)+"m "+Math.floor(seconds)+"s"
      }
    }

    /**
     * Convert milliseconds to minutes and seconds
     * @param millis
     */
    millisToMinutesAndSeconds(millis) {
      var minutes = Math.floor(millis / 60000);
      var seconds = ((millis % 60000) / 1000).toFixed(0);
      return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
    }

    async titleToSuiteId(title) {
      const match = title.match(/\bT?S(\d+)\b/g);
      return match.length ? match[0] : '';
    }

    /**
     * Search for all applicable test cases
     * @param title
     * @returns {any}
     */
    async titleToCaseIds(title) {
      const match = title.match(/\bT?C(\d+)\b/g);
      return await match.length ? match[0] : '';
    }

    async computeResults(){
      var resultsPayload = []
      const suiteData = require("../allure-report/data/suites.json");

      for(var i=0;i<suiteData.children.length;i++){
        var caseDataTemp = suiteData.children[i].children;

        for(var k=0;k<caseDataTemp.length;k++){  
          var caseResultTemp = {
            "case_id": '',
            "status_id": '',
            "comment": "",
            "elapsed": "",
          }

          caseResultTemp.case_id = parseInt(caseDataTemp[k].name.split(" ")[0].split("C")[1]);
          var statusId = null;
          var caseComment = null;
          switch(caseDataTemp[k].status){
            case "passed":
              statusId = 1,
              caseComment = "Test Passed";
              break;
            case "failed":
              statusId = 5,
              caseComment = "Test Failed";
              break;
            case "broken":
              statusId = 5,
              caseComment = "Test Failed/Broken";
              break;
            case "skipped":
              statusId = 2,
              caseComment = "Test Skipped";
              break;
          }
          caseResultTemp.status_id = parseInt(statusId)
          caseResultTemp.comment = caseComment
          caseResultTemp.elapsed = caseDataTemp[k].time.duration ? '0' : this.millisToStringifyMinutesAndSeconds(caseDataTemp[k].time.duration)
          resultsPayload.push(caseResultTemp)
        }
      }

      return resultsPayload
    }
    /**
     * @param {number} runId
     * @param {{case_id, status_id, comment}[]} results
     * @return {*}
     */
     async addResultsForCases(runId) {

       axios.post(
        `${this.url}/index.php?/api/v2/add_results_for_cases/${runId}`,
        {
          results: await this.computeResults()
        },
          this.authPayload
        )
        .then((response) => {
          console.log("~~ Test results added to the TestRail run ~~");
        })
        .catch((err)=>{
            console.log(err.response.data)
        })
    }

    
    async createRun(projectId, suiteId, runName = false) {
        let now = new Date();
        let options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        let name = now.toLocaleString(['en-GB'], options);
        if (runName) {
            name = runName;
        }

        //Post the request
        const summary = require("../allure-report/widgets/summary.json");
        axios.post(
          `${this.url}/index.php?/api/v2/add_run/${projectId}`,
          {
            suite_id: suiteId,
            name: name+" / Total Execution Time: "+this.millisToMinutesAndSeconds(summary.time.duration).toString(),
            include_all: true,
          },
          this.authPayload
        )
        .then((response)=>{
          console.log(`~~ Test run created in TestRail as : ${response.data.name} ~~`);
          this.addResultsForCases(response.data.id);
        })
        .catch((error)=> {
          console.log("~~ Failed to create run on TestRail ~~"+error.response.data);
          throw error;
        });
    }
}

exports.TestRailReporter = TestRailReporter;