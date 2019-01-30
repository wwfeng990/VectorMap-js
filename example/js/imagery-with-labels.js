WebFont.load({
    custom: {
        families: ['vectormap-icons'],
        urls: ['https://cdn.thinkgeo.com/vectormap-icons/1.0.0/vectormap-icons.css']
    }
});

//Label featuer
let imageryLabeLayer = new ol.mapsuite.VectorTileLayer("thinkgeo-world-streets-hybrid.json", {
    apiKey: 'WPLmkj3P39OPectosnM1jRgDixwlti71l8KYxyfP2P0~', // please go to https://cloud.thinkgeo.com to create
    visible: true
});

//image feature
let imageryLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg'
    }),
});

//create map
let map = new ol.Map({
    loadTilesWhileAnimating: true,
    loadTilesWhileInteracting: true,
    layers: [imageryLayer, imageryLabeLayer],
    target: 'map',
    view: new ol.View({
        center: ol.proj.fromLonLat([-96.79620, 35.79423]),
        maxZoom: 7,
        maxResolution: 40075016.68557849 / 512,
        zoom: 3,
        minZoom: 3,

    }),
});

map.addControl(new ol.control.FullScreen());