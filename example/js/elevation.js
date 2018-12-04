var _selectedWaypoint;
var _chart;
var _chartCtx;
var styles;
var draw;
var _samplesNumber;
var interval;
var intervalLine;
var intervalDistanceUnit = "Feet";

window.app = {};
const app = window.app;


app.drawLineControl = function (opt_options) {
  const options = opt_options || {};
  const button = document.createElement('button');
  button.className = 'line';
  const this_ = this;
  const element = document.createElement('div');
  element.className = 'drawline ol-unselectable ol-control';
  element.appendChild(button);
  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
};

app.drawPolygonControl = function (opt_options) {
  const options = opt_options || {};
  const button = document.createElement('button');
  button.className = 'Polygon';
  const this_ = this;
  const element = document.createElement('div');
  element.className = 'drawPolygon ol-unselectable ol-control';
  element.appendChild(button);
  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
};
ol.inherits(app.drawLineControl, ol.control.Control);
ol.inherits(app.drawPolygonControl, ol.control.Control);

$(function () {
  var defaultClient = GisServerApis.ApiClient.instance;
  defaultClient.basePath = "https://cloud3.thinkgeo.com";
  var APIKey = defaultClient.authentications['API Key'];
  APIKey.apiKey = 'v8pUXjjVgVSaUOhJCZENyNpdtN7_QnOooGkG0JxEdcI~';

});

let satelliteLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: "https://cloud3.thinkgeo.com/api/v1/maps/raster/aerial/x1/3857/512/{z}/{x}/{y}.jpeg"
      + "?apiKey=v8pUXjjVgVSaUOhJCZENyNpdtN7_QnOooGkG0JxEdcI~",
    tileSize: 512,
  }),
});


var addFeature = function (feature) {
  createVector().getSource().addFeature(feature);
};
var removeFeature = function (feature) {
  createVector().getSource().removeFeature(feature);
};

var styles = {
  'waypoint': new ol.style.Style({
    image: new ol.style.Circle({
      radius: 3,
      snapToPixel: false,
      fill: new ol.style.Fill({
        color: 'black'
      }),
      stroke: new ol.style.Stroke({
        color: 'white',
        width: 1
      })
    })
  }),
  'waypoint-selected': new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 1],
      src: '../image/waypoint.png'
    })
  }),
  'start': new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 1],
      src: '../image/start.png'
    })
  }),
  'end': new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 1],
      src: '../image/end.png'
    })
  }),
  'route': new ol.style.Style({
    stroke: new ol.style.Stroke({
      width: 2,
      color: [181, 232, 88]
    })
  })
};

var source = new ol.source.Vector();
var createVector = function () {
  return new ol.layer.Vector({
    source: source,
    style: function (feature) {
      var key = feature.get('type');
      return styles[key];
    }
  });
}

var map = new ol.Map({
  loadTilesWhileAnimating: true,
  loadTilesWhileInteracting: true,
  controls: ol.control.defaults({
    attributionOptions: {
      collapsible: false
    }
  }).extend([
    new app.drawLineControl()
  ]).extend([
    new app.drawPolygonControl()
  ]),
  layers: [satelliteLayer, createVector()],
  target: 'map',
  view: new ol.View({
    center: ol.proj.fromLonLat([-121.64325200613075, 47.6966203898931]),
    zoom: 16
  })
});

map.getInteractions().forEach(function (element, index, array) {
  if (element instanceof ol.interaction.MouseWheelZoom)
    element.setActive(false);
})
map.addInteraction(new ol.interaction.DragPan({
  condition: function (event) {
    return event.originalEvent.ctrlKey
  }
}));

var mapEle = document.getElementById("map");




function disableZoom(e) {
  var e = e || window.event;
  if (e.keyCode == 17 && map) {
    map.getInteractions().forEach(function (element, index, array) {
      if (element instanceof ol.interaction.MouseWheelZoom)
        element.setActive(false);
    })
  }
}

var drawLineElevation = function (feature) {
  var apiInstance = new GisServerApis.ElevationApi();
  var line = feature.getGeometry();
  $("#IntervalDistance").html(parseInt(line.getLength() / $("#samples-number").val()) + " (feet)")
  if (line.getLength() > 5000) {
    $('#error-tip').text('The test distance is too long and the input is invalid. Please re-enter!')
    $('.error-tip').css({
      'display': 'block'
    })
    map.removeInteraction(
      new ol.interaction.Draw({
        source: source,
        type: 'LineString'
      }));
    clear();
  } else {

    var format = new ol.format.WKT();
    var wkt = format.writeGeometry(feature.getGeometry());
    var opts = {
      'srid': 3857,
      'numberOfSegments': _samplesNumber || 15,
      'intervalDistance': intervalLine || null,
      'elevationUnit': "Feet",
      'intervalDistanceUnit': intervalDistanceUnit || "Feet"
    };

    var grades = [];
    apiInstance.getGradeOfLineV1(wkt, opts, function (error, data, response) {
      if (error) {
        console.error(error);
      } else {
        for (let i = 0; i < data.data.length; i++) {
          var grade = data.data[i].grade;
          grades.push(grade);
        }
      }
    });

    var callback = function (error, data, response) {
      if (error) { } else {
        var coordinates = feature.getGeometry().getLastCoordinate();
        addFeature(new ol.Feature({
          geometry: new ol.geom.Point(coordinates),
          type: 'end'
        }));
        for (let i = 0; i < data.data.length; i++) {
          var item = data.data[i];
          var start = data.data[0];
          var waypoint = format.readFeature(item.wellKnownText);
          var startpoint = format.readFeature(start.wellKnownText);
          startpoint.set('type', 'start');
          waypoint.set('type', 'waypoint');
          addFeature(startpoint);
          addFeature(waypoint);
        }
        var datas = getChartDataSet(data.data)
        drawChart(datas, grades);

      }
    };
    apiInstance.getElevationOfLineV1(wkt, opts, callback);

  }
}

var canExecuteApiCall = function () {
  var samplesNumber = $('#samples-number').val();
  if (Number.isNaN(samplesNumber)) {
    return false;
  }
  return parseInt(samplesNumber) > 0;
};
var canExecuteApiCallLine = function () {
  var samplesNumber = $('#samples-number-line').val();
  if (Number.isNaN(samplesNumber)) {
    return false;
  }
  return parseInt(samplesNumber) > 0;
};
var canExecuteApiCallP = function () {
  var intervalNumber = $('#samples-number-p').val();
  if (Number.isNaN(intervalNumber)) {
    return false;
  }
  return parseFloat(intervalNumber) > 0;
};
var featureLine;
$(".drawline").click(function () {
  _samplesNumber = $("#samples-number").val();
  intervalLine = null;
  $('#side-bar-p').hide();
  $('#side-bar-point').hide();
  $("#side-bar").show();
  clear();
  drawChart(null);
  _selectedWaypoint = null;
  map.removeInteraction(draw);
  draw = new ol.interaction.Draw({
    source: source,
    type: 'LineString'
  })
  map.addInteraction(draw);
  draw.on('drawend', function (feature) {
    featureLine = feature.feature;
    featureLine.set('type', 'route');
    drawLineElevation(featureLine);
  })

});

$('#samples-number').on('change', function () {
  _samplesNumber = $("#samples-number").val();
  intervalLine = null;
  clear();
  drawChart(null);
  _selectedWaypoint = null;
  if (canExecuteApiCall()) {
    if (featureLine) {
      drawLineElevation(featureLine);
      featureLine.set('type', 'route');
      addFeature(featureLine);
    } else {
      drawLineElevation(featureDefault);
      featureDefault.set('type', 'route');
      addFeature(featureDefault);
    }
    featureLine.set('type', 'route');
    addFeature(featureLine);
  }
});
var drawPolygonElevation = function (feature, interval) {
  var apiInstance = new GisServerApis.ElevationApi();
  var polygon = feature.getGeometry();
  var area = polygon.getArea();
  if (area < 200000) {
    $('#error-tip').text('The test Area is too small and the input is invalid. Please re-enter!')
    $('.error-tip').css({
      'display': 'block'
    })
    map.removeInteraction(
      new ol.interaction.Draw({
        source: source,
        type: 'LineString'
      }));
    clear();
  } else {

    var format = new ol.format.WKT();
    var wkt = format.writeGeometry(feature.getGeometry());
    var optss = {
      'srid': 3857,
      'intervalDistance': interval,
      'elevationUnit': "Feet",
      'intervalDistanceUnit': intervalDistanceUnit
    };
    var grades = [];
    var callback = function (error, data, response) {
      if (error) {
        //  console.log('error');
      } else {
        for (let i = 0; i < data.data.length; i++) {
          var item = data.data[i];
          var start = data.data[0];
          var waypoint = format.readFeature(item.wellKnownText);
          var startpoint = format.readFeature(start.wellKnownText);
          startpoint.set('type', 'start');
          waypoint.set('type', 'waypoint');
          addFeature(startpoint);
          addFeature(waypoint);
        }
        /*    drawCalibration(data.data); */
        var datas = getChartDataSet(data.data);
        drawChart(datas);

      }
    };
    apiInstance.getElevationOfAreaV1(wkt, optss, callback);
  }
}
var featureDefault;
var polygonDefault = function () {
  var defaultClient = GisServerApis.ApiClient.instance;
  defaultClient.basePath = "https://cloud1.thinkgeo.com";
  var APIKey = defaultClient.authentications['API Key'];
  APIKey.apiKey = 'v8pUXjjVgVSaUOhJCZENyNpdtN7_QnOooGkG0JxEdcI~';

  featureDefault = new ol.Feature({
    geometry: new ol.geom.LineString([
      [-13541888.484786397, 6056958.501631321],
      [-13541864.598215058, 6056894.0078887055],
      [-13541874.152843593, 6056853.400717429],
      [-13541881.318814995, 6056812.793546153],
      [-13541890.87344353, 6056762.631746341],
      [-13541914.76001487, 6056662.308146716],
      [-13541888.484786397, 6056607.369032636],
      [-13541828.76835805, 6056593.037089833],
      [-13541752.331329763, 6056593.037089833],
      [-13541661.562358676, 6056595.425746967],
      [-13541582.736673256, 6056614.535004038],
      [-13541513.465616373, 6056636.032918244],
      [-13541475.24710223, 6056633.64426111],
      [-13541429.862616686, 6056624.089632574],
      [-13541336.704988463, 6056612.146346904],
      [-13541265.045274446, 6056597.814404101],
      [-13541190.996903295, 6056518.988718682],
      [-13541195.774217563, 6056452.106318932],
      [-13541183.830931893, 6056380.446604915],
      [-13541174.276303357, 6056306.398233764],
      [-13541174.276303357, 6056227.572548345]
    ])
  });
  featureDefault.set('type', 'route');
  addFeature(featureDefault);
  drawLineElevation(featureDefault)
}
$(
  polygonDefault()
);

var featurePolygon;
$(".drawPolygon").click(function () {
  interval = 1.0;
  // $('#numberSamplesp').show();
  $('#side-bar').hide();
  $('#side-bar-point').hide();
  $('#side-bar-p').show();
  clear();
  drawChart(null);
  _selectedWaypoint = null;
  map.removeInteraction(draw);
  draw = new ol.interaction.Draw({
    source: source,
    type: 'Polygon'
  });
  map.addInteraction(draw);
  draw.on('drawend', function (feature) {
    featurePolygon = feature.feature;
    featurePolygon.set('type', 'route');
    drawPolygonElevation(featurePolygon);
  })

  $('#samples-number-p').on('change', function () {
    clear();
    drawChart(null);
    _selectedWaypoint = null;
    if (canExecuteApiCallP()) {
      var intervalNumber = parseFloat($('#samples-number-p').val());
      if (intervalNumber !== interval) {
        intervalDistanceUnit = $('#intervalDistanceUnitPoly').val()
        interval = intervalNumber;
        drawPolygonElevation(featurePolygon, interval);
        featurePolygon.set('type', 'route');
        addFeature(featurePolygon);

      }
    }
  });
});

var clear = function () {
  // Clear Elevation Layer.
  var source = createVector().getSource();
  source.clear();
};

function sortNumber(a, b) {
  return a - b
}
var getSequentialArray = function (data) {
  var values = [];
  for (var i = 0; i < data.length; i++) {
    values.push(data[i].elevation);
  }
  return values.sort(sortNumber);
}

var getChartDataSet = function (data) {
  var labels = [];
  var values = [];
  for (var i = 0; i < data.length; i++) {
    labels.push(i + 1);
    values.push(data[i].elevation);
  }
  return {
    originaldata: data,
    labels: labels,
    datasets: [{
      fill: false,
      backgroundColor: 'rgb(255, 159, 64)',
      borderColor: 'rgb(255, 159, 64)',
      pointStrokeColor: '#fff',
      pointHighlightFill: '#fff',
      pointHighlightStroke: 'rgba(151,187,205,1)',
      data: values
    }]
  };
};

var initChart = function () {
  _chartCtx = document.getElementById('chartContainer').getContext("2d");
}
var drawChart = function (data, grades) {
  if (_chart) {
    _chart.destroy();
  }
  _chart = new Chart(_chartCtx, {
    type: 'line',
    data: data,
    options: {
      legend: {
        display: false
      },
      responsive: true,
      maintainAspectRatio: false,
      title: {
        display: false,
        text: ''
      },
      tooltips: {
        mode: 'index',
        intersect: false,
        displayColors: false,
        callbacks: {
          label: function (tooltipItem, data) {
            var label = data.datasets[tooltipItem.datasetIndex].label || '';
            if (label) {
              label += ': ';
            }
            var elevation = data.originaldata[tooltipItem.index];
            if (grades == null) {
              label += 'Elevation: ' + elevation.elevation + 'ft';
            } else {
              label += 'Elevation: ' + elevation.elevation + 'ft' + '  grade: ' + grades[tooltipItem.index];
            }
            if (_selectedWaypoint) {
              removeFeature(_selectedWaypoint);
            }
            var wktReader = new ol.format.WKT();
            _selectedWaypoint = wktReader.readFeature(elevation.wellKnownText);
            _selectedWaypoint.set('type', 'waypoint-selected');
            addFeature(_selectedWaypoint);
            return label;
          }
        }
      },
      hover: {
        mode: 'nearest',
        intersect: true
      },
      scales: {
        xAxes: [{
          display: true,
          scaleLabel: {
            display: false,
            labelString: 'Distance(KM)'
          }
        }],
        yAxes: [{
          display: true,
          scaleLabel: {
            display: true,
            labelString: 'Elevation(ft)'
          },
          ticks: {
            callback: function (value) {
              if (Math.floor(value) === value) {
                return value;
              }
            }
          }
        }]
      }
    }
  });
};


$(initChart(), drawChart());
$('#side-bar-point').hide(),
  $('#side-bar-p').hide(),
  $('#IntervalDistanceLine').show(),

  $(function () {

    $(".line").click(function () {
      $(".point").css({
        "background": "url('../image/add_point_off.png')",
        "background-size": "100% 100%"
      });
      $(this).css({
        "background": "url('../image/draw_line_on.png')",
        "background-size": "100% 100%"
      });
      $(".Polygon").css({
        "background": "url('../image/draw_polygon_off.png')",
        "background-size": "100% 100%"
      });
      $('.error-tip').css('display', 'none');
    });
    $(".Polygon").click(function () {
      $(".point").css({
        "background": "url('../image/add_point_off.png')",
        "background-size": "100% 100%"
      });
      $(".line").css({
        "background": "url('../image/draw_line_off.png')",
        "background-size": "100% 100%"
      });
      $(this).css({
        "background": "url('../image/draw_polygon_on.png')",
        "background-size": "100% 100%"
      });
      $('.error-tip').css('display', 'none');
    });
  });

$(".buttonClear").click(function () {
  clear();
  drawChart(null);
  $(".point").css({
    "background": "url('../image/add_point_off.png')",
    "background-size": "100% 100%"
  });
  $(".line").css({
    "background": "url('../image/draw_line_off.png')",
    "background-size": "100% 100%"
  });
  $(".Polygon").css({
    "background": "url('../image/draw_polygon_off.png')",
    "background-size": "100% 100%"
  });
  $('.error-tip').css('display', 'none');
});