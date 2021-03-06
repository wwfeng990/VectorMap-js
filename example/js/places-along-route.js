/*===========================================================================*/
// Places Along Route
// Sample map by ThinkGeo
// 
//   1. ThinkGeo Cloud API Key
//   2. Map Control Setup
//   3. ThinkGeo Map Icon Fonts
//   4. Routing Setup
//   5. Reverse Geocoding Setup
//   6. Derive the Custom Class Drag
//   7. Event Listeners
/*===========================================================================*/


/*---------------------------------------------*/
// 1. ThinkGeo Cloud API Key
/*---------------------------------------------*/

// First, let's define our ThinkGeo Cloud API key, which we'll use to
// authenticate our requests to the ThinkGeo Cloud API.  Each API key can be
// restricted for use only from a given web domain or IP address.  To create your
// own API key, you'll need to sign up for a ThinkGeo Cloud account at
// https://cloud.thinkgeo.com.
const apiKey = 'WPLmkj3P39OPectosnM1jRgDixwlti71l8KYxyfP2P0~';

/*---------------------------------------------*/
// 2. Map Control Setup
/*---------------------------------------------*/

// Here's where we set up our map.  We're going to create layers, styles, 
// and define our initial view when the page first loads.

// Now we'll create the base layer for our map.  The base layer uses the ThinkGeo
// Cloud Maps Vector Tile service to display a detailed street map.  For more
// info, see our wiki:
// https://wiki.thinkgeo.com/wiki/thinkgeo_cloud_maps_vector_tiles
const darkLayer = new ol.mapsuite.VectorTileLayer('https://cdn.thinkgeo.com/worldstreets-styles/3.0.0/dark.json', {
    apiKey: apiKey,
    layerName: 'dark'
});

// Create a default view for the map when it starts up.
let startPoint = [-97.15978246267731, 32.759946696418766];
let endPoint = [-96.3213122920232, 32.72026579501042];
let contextmenuCoord = [];
const view = new ol.View({
    // Center the map on Boston and start at zoom level 8.
    center: ol.proj.fromLonLat([-96.75100604890212, 32.74980711394525]),
    maxResolution: 40075016.68557849 / 512,
    progressiveZoom: true,
    zoom: 10,
    minZoom: 2,
    maxZoom: 19
});

// This function will create and initialize our interactive map.
// We'll call it later when our POI icon font has been fully downloaded,
// which ensures that the POI icons display as intended.
let map;
let app = {};
let vectorSource, placeSource;
let popup;

const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');
const insTip = document.querySelector('#instruction-tip');
const initializeMap = () => {
    map = new ol.Map({
        renderer: 'webgl',
        loadTilesWhileAnimating: true,
        loadTilesWhileInteracting: true,
        // Add our previously-defined ThinkGeo Cloud Vector Tile layer to the map.
        layers: [darkLayer],
        // States that the HTML tag with id="map" should serve as the container for our map.
        target: document.getElementById('map'),
        view: view,
        // Add an interaction to map that allows drag point icon.
        interactions: ol.interaction.defaults().extend([new app.Drag()])
    });

    // Add the vector layer for showing the driving start icon.
    vectorSource = new ol.source.Vector();
    map.addLayer(new ol.layer.Vector({
        source: vectorSource
    }));
    showDrivingStartPoint();

    // Add the vector layer for showing the searched places.
    placeSource = new ol.source.Vector();
    map.addLayer(new ol.layer.Vector({
        source: placeSource
    }));

    // Create the popup for showing the information of place when mouse is hover on the icon.
    popup = new ol.Overlay({
        element: container,
        autoPan: true,
        autoPanAnimation: {
            duration: 250
        }
    });
    map.addOverlay(popup);

    /**
     * Add a click handler to hide the popup.
     * @return {boolean} Don't follow the href.
     */
    closer.onclick = function () {
        popup.setPosition(undefined);
        closer.blur();
        return false;
    };

    // display popup when click on the place icon.
    map.on('click', function (evt) {
        var feature = map.forEachFeatureAtPixel(evt.pixel,
            function (feature) {
                return feature;
            }, {
                layerFilter: (layer) => {
                    return !(layer instanceof ol.mapsuite.VectorTileLayer)
                }
            });
        if (feature && feature.get('name') === 'place') {
            var coordinates = feature.getGeometry().getCoordinates();
            popup.setPosition(coordinates);
            content.innerHTML = feature.get('content');
        }
    });

    // change mouse cursor as pointer when over icon.
    map.on('pointermove', function (e) {
        if (e.dragging) {
            return;
        }

        var pixel = map.getEventPixel(e.originalEvent);
        var feature = map.forEachFeatureAtPixel(pixel,
            function (feature) {
                return feature;
            }, {
                layerFilter: (layer) => {
                    return !(layer instanceof ol.mapsuite.VectorTileLayer)
                }
            });

        if (feature) {
            const featureName = feature.get('name');
            if (featureName == 'place' || featureName === 'start' || featureName === 'end') {
                map.getTarget().style.cursor = 'pointer';
            } else {
                map.getTarget().style.cursor = '';
            }
        } else {
            map.getTarget().style.cursor = '';
        }
    });

    // Add an event lister which will shows when we right click on the map.
    map.getViewport().addEventListener('contextmenu', function (e) {
        let left, top;
        let clientWidth = document.documentElement.clientWidth;
        let clientHeight = document.documentElement.clientHeight;
        const contextmenu = document.querySelector('#ol-contextmenu');
        const contextWidth = 165;
        insTip.classList.add('gone');
        // Add an event lister which will shows when we right click on the map.
        left =
            e.clientX + contextWidth > clientWidth ? clientWidth - contextWidth : e.clientX;
        top =
            e.clientY + contextmenu.offsetHeight > clientHeight ?
            clientHeight - contextmenu.offsetHeight :
            e.clientY;

        contextmenu.style.left = left + 'px';
        contextmenu.style.top = top + 'px';
        const point = map.getEventCoordinate(e);
        contextmenuCoord = new ol.proj.transform(point, 'EPSG:3857', 'EPSG:4326');
        document.querySelector('#ol-contextmenu').classList.remove('hide');
    });

    // By default, perform the service-line request and then caluclate the places whthin the driving-line on the map.
    performRouting();
};

// Show the driving start icon on the map.
let startFeature;
let endFeature;
const showDrivingStartPoint = () => {
    startFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(startPoint)),
        name: 'start'
    });
    endFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(endPoint)),
        name: 'end'
    });
    startFeature.setStyle(styles.start);
    endFeature.setStyle(styles.end);
    vectorSource.addFeature(startFeature);
    vectorSource.addFeature(endFeature);
}

/*---------------------------------------------*/
// 3. ThinkGeo Map Icon Fonts
/*---------------------------------------------*/

// Finally, we'll load the Map Icon Fonts using ThinkGeo's WebFont loader. 
// The loaded Icon Fonts will be used to render POI icons on top of the map's 
// background layer.  We'll initalize the map only once the font has been 
// downloaded.  For more info, see our wiki: 
// https://wiki.thinkgeo.com/wiki/thinkgeo_iconfonts 
WebFont.load({
    custom: {
        families: ["vectormap-icons"],
        urls: ["https://cdn.thinkgeo.com/vectormap-icons/2.0.0/vectormap-icons.css"],
        testStrings: {
            'vectormap-icons': '\ue001'
        }
    },
    // The "active" property defines a function to call when the font has
    // finished downloading.  Here, we'll call our initializeMap method.
    active: initializeMap
});

/*---------------------------------------------*/
// 4. Routing Setup
/*---------------------------------------------*/

// At this point we'll built up the methods and functionality that will  
// actually perform the routing using the ThinkGeo Cloud and then 
// display the results on the map.

// We use thinkgeocloudclient.js, which is an open-source Javascript SDK for making 
// request to ThinkGeo Cloud Service. It simplifies the process of the code of request.

// We need to create the instance of Routing client and authenticate the API key.
const routingClient = new tg.RoutingClient(apiKey);

// This method performs the actual routing using the ThinkGeo Cloud. 
// By passing the coordinates of the map location and some other options, we can 
// get back the route line as we send the request.  For more details, see our wiki:
// https://wiki.thinkgeo.com/wiki/thinkgeo_cloud_routing
let timer;
const errorMessage = document.querySelector('#error-message');
const performRouting = () => {
    const lineGeom = new ol.geom.LineString([ol.proj.fromLonLat(startPoint), ol.proj.fromLonLat(endPoint)]);
    const lineLength = lineGeom.getLength();
    if (lineLength > 200000) {
        errorMessage.classList.add('show');
        errorMessage.querySelector('p').innerHTML = "This sample only search for places within the first 200 km (120 miles)";
        return
    }

    placeSource.clear();
    popup.setPosition(undefined);
    vectorSource.getFeatures().some(feature => {
        if (feature.get('name') === 'line') {
            vectorSource.removeFeature(feature);
            return true;
        }
    })
    // Show the loading animation.
    document.querySelector('.loading').classList.remove('hide');
    errorMessage.classList.remove('show');

    const callback = (status, response) => {
        let message;
        if (status === 200) {
            // Draw the calculated driving line on the map.
            let drivingLine = drawDrivingLine(response.data);

            // Search the places you are intrested in within the driving line.
            searchPlaces(drivingLine);
        } else if (status === 410 || status === 401 || status === 400) {
            message = response.error ? response.error.message : (Object.keys(response.data).map(key => {
                return response.data[key];
            }) || 'The was a problem calculating the route. Please try again.');
        } else {
            message = 'The was a problem calculating the route. Please try again.';
        }

        if (message) {
            let resultCode = (status === 200 ? '' : status + ':');
            errorMessage.querySelector('p').innerHTML = `${resultCode} ${message}`;
            errorMessage.classList.add('show');
            timer = setTimeout(() => {
                errorMessage.classList.remove('show');
            }, 5000)
            document.querySelector('.loading').classList.add('hide');
        }
    }

    const waypoints = [{
        x: startPoint[0],
        y: startPoint[1]
    }, {
        x: endPoint[0],
        y: endPoint[1]
    }];

    routingClient.getRoute(waypoints, callback);
}

const drawDrivingLine = (res) => {
    // project result from EPSG:4326 to EPSG:3857
    const drivingLine = (new ol.format.WKT()).readFeature(res.routes[0].geometry, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
    });
    drivingLine.setStyle(styles.line);
    drivingLine.set('name', 'line');
    vectorSource.addFeature(drivingLine);

    return drivingLine;
}


/*---------------------------------------------*/
// 5. Reverse Geocoding Setup
/*---------------------------------------------*/

// At this point we'll built up the methods and functionality that will  
// actually perform the routing using the ThinkGeo Cloud and then 
// display the results on the map.

// We use thinkgeocloudclient.js, which is an open-source Javascript SDK for making 
// request to ThinkGeo Cloud Service. It simplifies the process of the code of request.

// We need to create the instance of Reverse Geocoding client and authenticate the API key.
let reverseGeocodingClient = new tg.ReverseGeocodingClient(apiKey);
reverseGeocodingClient.baseUrls_ = ["https://cloud.thinkgeo.com"];

// This method performs the actual reverse geocoding using the ThinkGeo Cloud. 
// By passing the line wkt,  location types you want to return and some other options, we can 
// get back the places as we send the request.  For more details, see our wiki:
// https://wiki.thinkgeo.com/wiki/thinkgeo_cloud_reverse_geocoding
const searchPlaces = (drivingLine) => {

    // Show the searched places with specific icons on the map.
    const placeType = document.querySelector('#place-type').selectedOptions[0];
    const callback = (status, response) => {
        // Hide the loading animation.
        if (timer !== undefined && timer !== null) {
            clearTimeout(timer);
        }
        document.querySelector('.loading').classList.add('hide');

        // Deal with search place response.
        let message;
        if (status === 200) {
            showPlaces(response.data, placeType.innerText);
        } else if (status === 410 || status === 401 || status === 400 || status === 403) {
            message = response.error ? response.error.message : (Object.keys(response.data).map(key => {
                return response.data[key];
            }) || "The request of searching places in driving line failed.");
        } else {
            message = 'The request of searching places in driving line failed.';
        }

        if (message) {
            errorMessage.querySelector('p').innerHTML = `${status}: ${message}`;
            errorMessage.classList.add('show');
            timer = setTimeout(() => {
                errorMessage.classList.remove('show');
            }, 5000)
        }
    }

    const lineWkt = (new ol.format.WKT()).writeGeometry(drivingLine.getGeometry());
    let resultNumber = document.querySelector('#result-number').value;
    if (resultNumber === 'all') {
        resultNumber = 10000;
    } else {
        resultNumber = Number(resultNumber);
    }
    if (reverseGeocodingClient.xhr) {
        reverseGeocodingClient.xhr.abort();
        delete reverseGeocodingClient.xhr;
    }
    reverseGeocodingClient.on("sendingrequest", function (e) {
        this.xhr = e.xhr;
    });
    reverseGeocodingClient.searchPlaceInAdvance({
        wkt: lineWkt,
        srid: 3857,
        locationTypes: placeType.value,
        maxResults: resultNumber
    }, callback);
    reverseGeocodingClient.un("sendingrequest");
}

const showPlaces = (res, placeType) => {
    for (let i = 0, l = res.nearbyLocations.length; i < l; i++) {
        let place = res.nearbyLocations[i].data;
        const title = place.locationName ? `<big>${place.locationName}</big>` : '';
        const content = `<div>${title}<small>(${place.locationType})</small><br/>${place.address.substring(place.address.indexOf(',') + 1, place.address.lastIndexOf(','))}</div>`
        const placeFeature = new ol.Feature({
            geometry: new ol.geom.Point([place.locationPoint.pointX, place.locationPoint.pointY]),
            content: content,
            name: 'place'
        });

        let style;
        switch (placeType) {
            case 'Hotels':
                style = styles.hotel;
                break;
            case 'Restaurants':
                style = styles.restaurant;
                break;
            case 'Gas Stations':
                style = styles.fuel;
                break;
            case 'Car Washes':
                style = styles.car;
                break;
        }

        placeFeature.setStyle(style);
        placeSource.addFeature(placeFeature);
    }
}


// In this custom object, we're going to define the styles of driving vehicle, searched places:
const styles = {
    start: new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 0.9],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            opacity: 1,
            crossOrigin: 'Anonymous',
            src: '../image/starting.png'
        })
    }),
    end: new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 0.9],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            opacity: 1,
            crossOrigin: 'Anonymous',
            src: '../image/ending.png'
        })
    }),
    line: new ol.style.Style({
        stroke: new ol.style.Stroke({
            width: 6,
            color: [34, 109, 214, 0.9]
        })
    }),
    walkLine: new ol.style.Style({
        stroke: new ol.style.Stroke({
            width: 2,
            lineDash: [5, 3],
            color: [34, 109, 214, 1]
        })
    }),
    // The icon of bbq, cafe, fast_food, food_court, restaurant.
    restaurant: new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 1],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            opacity: 1,
            crossOrigin: "Anonymous",
            src: '../image/place-icons/restaurant.png',
            imgSize: [32, 32]
        }),
        zIndex: 2
    }),
    // The icon of fuel.
    fuel: new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 1],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            opacity: 1,
            crossOrigin: "Anonymous",
            src: '../image/place-icons/fuel.png',
            imgSize: [32, 32]
        }),
        zIndex: 2
    }),
    // The icon of hotel, motel. 
    hotel: new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 1],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            opacity: 1,
            crossOrigin: "Anonymous",
            src: '../image/place-icons/hotel.png',
            imgSize: [32, 32]
        }),
        zIndex: 2
    }),
    // The icon of car wash. 
    car: new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 1],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            opacity: 1,
            crossOrigin: "Anonymous",
            src: '../image/place-icons/car.png',
            imgSize: [32, 32]
        }),
        zIndex: 2
    })
};


/*---------------------------------------------*/
// 6. Derive the Custom Class Drag
/*---------------------------------------------*/

// Since we need to drag the point to change the destination or start location, 
// we have to make the point draggable. At this step, we derived the custom class Drag.
app.Drag = function () {
    ol.interaction.Pointer.call(this, {
        handleDownEvent: app.Drag.prototype.handleDownEvent,
        handleDragEvent: app.Drag.prototype.handleDragEvent,
        handleUpEvent: app.Drag.prototype.handleUpEvent
    });
    this.coordinate_ = null;
    this.feature_ = null;
};
ol.inherits(app.Drag, ol.interaction.Pointer);

// Function handling "down" events.
// If the function returns true then a drag sequence is started.
app.Drag.prototype.handleDownEvent = function (evt) {
    let map = evt.map;
    let feature = map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
        let featureName = feature.get('name');
        if (featureName === 'start' || featureName === 'end') {
            return feature;
        }
    }, {
        layerFilter: (layer) => {
            return !(layer instanceof ol.mapsuite.VectorTileLayer)
        }
    });

    if (feature) {
        this.coordinate_ = evt.coordinate;
        this.feature_ = feature;
    }

    return !!feature;
};

// Function handling "drag" events. 
// This function is called on "move" events during a drag sequence.
app.Drag.prototype.handleDragEvent = function (evt) {
    let deltaX = evt.coordinate[0] - this.coordinate_[0];
    let deltaY = evt.coordinate[1] - this.coordinate_[1];

    let geometry = this.feature_.getGeometry();
    geometry.translate(deltaX, deltaY);
    this.coordinate_[0] = evt.coordinate[0];
    this.coordinate_[1] = evt.coordinate[1];
};

// Function handling "up" events.
// If the function returns false then the current drag sequence is stopped.
app.Drag.prototype.handleUpEvent = function (e) {
    const coord = this.feature_.getGeometry().getCoordinates();
    const featureType = this.feature_.get('name');
    let coord_ = [];
    insTip.classList.add('gone');
    switch (featureType) {
        case 'start':
            coord_ = ol.proj.transform(coord, 'EPSG:3857', 'EPSG:4326');
            startPoint = coord_.slice();
            break;
        case 'end':
            coord_ = ol.proj.transform(coord, 'EPSG:3857', 'EPSG:4326');
            endPoint = coord_.slice();
            break;
    }
    performRouting();
    this.coordinate_ = null;
    this.feature_ = null;
    return false; // `false` to stop the drag sequence.

};

/*---------------------------------------------*/
// 7. Event Listeners
/*---------------------------------------------*/

// These event listeners tell the UI when it's time to execute all of the 
// code we've written.
document.addEventListener('DOMContentLoaded', function () {
    // Handle the click event when click the item in the customized context menu.
    document.querySelector('#ol-contextmenu').addEventListener('click', (e) => {
        e = window.event || e;
        const targetId = e.target.id;
        switch (targetId) {
            case 'add-start-point':
                document.querySelector('#ol-contextmenu').classList.add('hide');
                startPoint = contextmenuCoord;
                startFeature.setGeometry(new ol.geom.Point(ol.proj.fromLonLat(startPoint)));
                performRouting();
                break;
            case 'add-end-point':
                document.querySelector('#ol-contextmenu').classList.add('hide');
                endPoint = contextmenuCoord;
                endFeature.setGeometry(new ol.geom.Point(ol.proj.fromLonLat(endPoint)));
                performRouting();
                break;
        }
    });

    // Hide the context menu of the browsers when right click on the map.
    document.querySelector('#map').oncontextmenu = () => {
        return false;
    };

    // When click on the map, hide the context menut.
    document.querySelector('#map').onclick = (e) => {
        document.querySelector('#ol-contextmenu').classList.add('hide');
    };

    // Perform the routing line request and place search request when changed the place type.
    document.querySelector('#place-type').addEventListener('change', function () {
        performRouting();
    });

    // Perform the routing line request and place search request when changed the result number.
    document.querySelector('#result-number').addEventListener('change', function () {
        performRouting();
    });
})