//Title:    Report Generator for EROAD
//Desc:     Speeds up weekly reporting by compiling daily activity reports for a selected unit and printing them as one job
//Author:   Jake Field
//Date:     16/03/18
//----------------------------------------------------------------------------------------------------------------------------------
//
//Global Variables
//----------------------------------------------------------------------------------------------------------------------------------
var g_ReportDiv = null;
var g_ProgressPopup = null;
var g_ProgressMax = 0;
var g_QueuedUnitReports = []; //[[unitID,DATE], ...]
//----------------------------------------------------------------------------------------------------------------------------------
//
//Functions
//----------------------------------------------------------------------------------------------------------------------------------
function finalizeReport() {
    //Scale iframes to suit content
    g_ReportDiv.childNodes.forEach(_iframeReport => {
        _iframeReport.style.height = _iframeReport.contentWindow.document.body.scrollHeight + "px";
        _iframeReport.style.width = "100%";
    });

    //Hide progress popup
    g_ProgressPopup.style.visibility = "hidden";

    //Print all the iframes at once
    window.print();

    //Clean-up
    document.body.removeChild(g_ReportDiv);
    g_ReportDiv = null;
    g_QueuedUnitReports = [];
    g_ProgressMax = 0;
}

function recursiveReportLoad() {
    //Is this the first report?
    if (g_ReportDiv == null) {
        g_ReportDiv = document.createElement("div");
        g_ReportDiv.setAttribute("class", "customPrintableReport");
        document.body.appendChild(g_ReportDiv);
    }

    //Are there items to be reported?
    if (g_QueuedUnitReports.length == 0) {
        //Status Update
        g_ProgressPopup.getElementsByClassName("reportGenPopup_status")[0].innerHTML = "If the print dialog does not appear, try refreshing your page.";
        window.postMessage({ type: "reportGen", text: "finalizeReport" }, "*");
        return;
    }
    else {
        //Grab next report from the list
        var _nextReport = g_QueuedUnitReports.pop();

        //Status Update
        g_ProgressPopup.getElementsByClassName("reportGenPopup_status")[0].innerHTML = "Building report " + (g_ProgressMax - g_QueuedUnitReports.length) + " of " + g_ProgressMax + "... Please Wait...";

        //Create the iframe for the report
        var _newReport = document.createElement("iframe");
        _newReport.setAttribute("src", "/Portal/report/dailyactivityreport/show?machineId=" + _nextReport[0] + "&repdate=" + _nextReport[1] + "&view=printscreen");
        _newReport.setAttribute("class", "customReport");
        _newReport.setAttribute("id", _nextReport[0] + ":" + _nextReport[1]); //For debugging purposes (EASE OF READING YUH HUH)
        _newReport.setAttribute("frameborder", "0");
        _newReport.setAttribute("scrolling", "no");
        _newReport.setAttribute("onload", "setTimeout(function () { window.postMessage({ type: \"reportGen\", text: \"recursiveReport\"}, \"*\"); }, 1500);");
        g_ReportDiv.appendChild(_newReport);
    }
}

function printWeeklyReport() {
    //Get last monday's timestamp (full working week)
    var _beforeOneWeek = new Date(new Date().getTime() - (60 * 60 * 24 * 7 * 1000))
        , _day = _beforeOneWeek.getDay()
        , _diffToMonday = _beforeOneWeek.getDate() - (_day + (_day === 0 ? -6 : 1)) + 8 //8 because we want the reports to file date ascending
        , _lastMonday = new Date(_beforeOneWeek.setDate(_diffToMonday));

    //Populate queue
    var _unitList = document.getElementById("machineDataList").firstChild;
    _unitList.childNodes.forEach(_unit => {
        //if (_unit.getAttribute("tabindex") == 0) { //Uncomment this to do a single truck instead of all in list
            var _reportDate = new Date(_lastMonday);
            for (i = 0; i < 7; ++i) {
                if (_unit.getAttribute("id") != null) g_QueuedUnitReports.push([_unit.getAttribute("id"), _reportDate.getFullYear() + "," + (_reportDate.getMonth() + 1) + "," + _reportDate.getDate()]);
                _reportDate.setDate(_reportDate.getDate() - 1); //Done here so the month updates correctly if week spreads over two months
                //Remeber to make the + 1 instead of - 1 in case of changing the +7 above
            }
        //}
    });

    //Selected truck test
    if (g_QueuedUnitReports.length == 0) {
        alert("Please select a truck from the vehicles panel!");
        return;
    }

    //For status
    g_ProgressPopup.style.visibility = "visible";
    g_ProgressMax = g_QueuedUnitReports.length;

    //Start async report creation
    recursiveReportLoad();
};
//----------------------------------------------------------------------------------------------------------------------------------
//
//Content Script listener
//----------------------------------------------------------------------------------------------------------------------------------
var _port = chrome.runtime.connect();
window.addEventListener("message", function (event) {
    if (event.source != window) return;
    if (event.data.type && event.data.type == "reportGen") {
        if (event.data.text && event.data.text == "printReport") printWeeklyReport();
        if (event.data.text && event.data.text == "recursiveReport") recursiveReportLoad();
        if (event.data.text && event.data.text == "finalizeReport") finalizeReport();
    }
}, false);
//----------------------------------------------------------------------------------------------------------------------------------
//
//Content injection
//----------------------------------------------------------------------------------------------------------------------------------
//Create print button next to refresh button
var _refreshButton = document.getElementsByClassName("icon-animate icon-refresh buttonRefresh")[0];
var _printButton = document.createElement("a");
_printButton.innerText = "print report";
_printButton.setAttribute("href", "javascript:void()");
_printButton.setAttribute("class", "icon-small icon-print-med-01");
_printButton.setAttribute("title", "Print activity report for selected truck");
_printButton.addEventListener("click", function () { window.postMessage({ type: "reportGen", text: "printReport" }, "*"); }, false);
_refreshButton.parentElement.appendChild(_printButton);

//Create progress popup
g_ProgressPopup = document.createElement("div");
g_ProgressPopup.setAttribute("class", "reportGenPopup");
g_ProgressPopup.innerHTML = "<div class=\"reportGenPopup_window\"><p class=\"reportGenPopup_status\"></p></div>";
document.body.appendChild(g_ProgressPopup);
//----------------------------------------------------------------------------------------------------------------------------------