//Title:    Lumens moodboard generator
//Desc:     Speeds up catalog leading image selection by creating a moodboard of most (if not all) of it's products
//Author:   Jake Field
//Date:     10/18/20 (mmddyy)
//----------------------------------------------------------------------------------------------------------------------------------
//
//Global Variables
//----------------------------------------------------------------------------------------------------------------------------------
let g_desiredImageSize = 600; //Size of the source image retrieved
let g_thumbnailSize = 150; //Size the image appears on the moodboard
var g_moodboard = null;
var g_moodboardBackground = null;
var g_queuedProducts = []; //[productID, ...]
//----------------------------------------------------------------------------------------------------------------------------------
//
//Functions
//----------------------------------------------------------------------------------------------------------------------------------
//Get the product ids on a catalog page
function getProductIDs(_productCatalog) {
    if (_productCatalog != null) {
        //if catalog div exists, get product tile classes
        var products = _productCatalog.getElementsByClassName("product productcombotile product-hit-tile");
        if (products != null) {
            //If we found these tiles, strip the product ids from them
            Array.from(products).forEach(_product => {
                g_queuedProducts.push(_product.getAttribute("data-pid"));
            });
        }
    }
}

//Add an image to the moodboard
function addImage(_url) {
    var _image = document.createElement("img");
    _image.src = _url;
    _image.href = _url;
    _image.width = g_thumbnailSize;
    _image.height = g_thumbnailSize;
    g_moodboard.appendChild(_image);
}

//Recursive fetch of product images using an array of URLs, stopping (silently failing) when the next image returns not found (403 in this case)
function fetchLumensImages(urls) {
    var url = urls.pop();
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', url, true);
    xhr.onload = function (e) {
        //Silently fail if a 403 is returned (Lumen standard for missing image)
        if (xhr.readyState === 4 && xhr.status != 403) {
            addImage(url); //Add the image to the moodboard, removing it from the array
            if (urls.length != 0) {
                fetchLumensImages(urls); //Attempt to load next image, silently fails if 403, otherwise recursive
            }
        }
    }
    xhr.send();
}

//Generates an array of potential image urls which will be attempted to add to the moodboard
function getProductImages(_productID, _resolution) {
    var imgHost = "https://images.lumens.com/is/image/Lumens/";
    var imgAlt = "_alt";
    var imgAppend = "?$Lumens.com-" + _resolution + "$";
    var generatedImageURLs = [(imgHost + _productID + imgAppend)]; //Fill array with primary image first

    //Generate 100 Alternate image urls.
    for (var i = 1; i <= 100; ++i) {
        var url = imgHost + _productID + imgAlt;
        if (i < 10) url += "0"; //must be 01, 02, ..., 09, 10 ...
        url += i + imgAppend;

        generatedImageURLs.push(url);
    }

    //Cheating because lazy
    generatedImageURLs = generatedImageURLs.reverse();

    //Start recursion until failed, asynchronous.
    fetchLumensImages(generatedImageURLs);
}

//Generate the moodboard
function generateMoodboard() {
    if (g_moodboard != null) return;

    //create moodboard popup
    g_moodboardBackground = document.createElement("div");
    g_moodboardBackground.setAttribute("class", "moodboardBackground");
    g_moodboardBackground.style.visibility = "visible";
    g_moodboardBackground.addEventListener("click", function () { window.postMessage({ type: "moodboard", text: "clean" }, "*"); }, false);
    document.body.appendChild(g_moodboardBackground);

    g_moodboard = document.createElement("div");
    g_moodboard.setAttribute("class", "moodboard");
    g_moodboard.style.visibility = "visible";
    document.body.appendChild(g_moodboard);

    //call getProducts on current page (only doing one page at a time)
    getProductIDs(document);

    //start loading product images
    g_queuedProducts.forEach(_product => {
        getProductImages(_product, g_desiredImageSize);
    })
}

function cleanup() {
    //Lazy cleanup, just delete the two parent divs and clear the product list.
    g_queuedProducts = [];
    document.body.removeChild(g_moodboardBackground);
    document.body.removeChild(g_moodboard);
    g_moodboardBackground = null;
    g_moodboard = null;
}
//----------------------------------------------------------------------------------------------------------------------------------
//
//Content Script listener
//----------------------------------------------------------------------------------------------------------------------------------
var _port = chrome.runtime.connect();
window.addEventListener("message", function (event) {
    if (event.source != window) return;
    if (event.data.type && event.data.type == "moodboard") {
        if (event.data.text && event.data.text == "generate") generateMoodboard();
        if (event.data.text && event.data.text == "clean") cleanup();
    }
}, false);
//----------------------------------------------------------------------------------------------------------------------------------
//
//Content injection
//----------------------------------------------------------------------------------------------------------------------------------
//Create a generate moodbood link on catalog pages
var _resultCount = document.getElementsByClassName("showing-count")[0]; //Top level store
if (_resultCount == null) _resultCount = document.getElementsByClassName("productcount")[0]; //Sub level store (different?)
if (_resultCount != null) {
    var _moodboardButton = document.createElement("a");
    _moodboardButton.innerText = "Generate Moodboard";
    _moodboardButton.setAttribute("href", "javascript:void()");
    _moodboardButton.setAttribute("class", "moodboard_button");
    _moodboardButton.setAttribute("title", "Generate Moodboard");
    _moodboardButton.addEventListener("click", function () { window.postMessage({ type: "moodboard", text: "generate" }, "*"); }, false);
    _resultCount.parentElement.appendChild(_moodboardButton);
}
//----------------------------------------------------------------------------------------------------------------------------------