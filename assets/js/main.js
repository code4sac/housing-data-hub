---
---
var map = null;
window.onload = function() {
  
  $('.hover-tooltip').tooltip();
  $('.definition').popover(); 
  {% if page.layout == 'data' %}
  init() 
  {% endif %}
    //hubOb();
    //todo: add custom styles to style.css
  {% if page.layout == 'policy' or page.embed == true %}
  $('table').addClass('table table-striped');
  $('#organizations').before($('#viz-wrapper'));
  buildTOC();
  var vizData = '';
  $('.nav.toc').append('<li><a href="#">Back to Top</a></li>');
  $(".viz-wrapper").each(function(index, val) {
    vizData = browserData[$('#' + val.id + ' .data-browser-select').val()];
    loadViz(vizData, val.id);
  });
  $('.data-browser-select').change(function() {
    vizData = browserData[$(this).val()];
    loadViz(vizData, $(this).parent().attr('id'));
  });
  $('body').scrollspy({
    target: '.nav-toc'
  }) {% endif %}
  
  $('.action-links-source').on('click', function(e) {
    ga('send', 'event', 'Action Links', 'Get Source', '{{page.portalID}}: {{page.chart-title}}');
  });
  
  $('a.page-scroll').bind('click', function(event) {
    var $anchor = $(this);
    var $bodyMargin = $('body').css('margin-top').split("px")[0];
    $('html, body').stop().animate({
      scrollTop: $($anchor.attr('href')).offset().top - (+$bodyMargin + 10)
    }, 1000, 'easeInOutExpo');
    event.preventDefault();
  });
}

function loadViz(params, wrapper) {
  if (['map-point', 'map'].indexOf(params.type) != -1) {
    generateMap(params, wrapper);
  } else {
    generateChart(params, wrapper);
  }
}

function buildTOC() {
  $('h2').each(function(i, el) {
    $('.nav.toc').append('<li><a href="#' + $(el).attr('id') + '" class="page-scroll">' + $(el).html() + '</a></li>');
  })
}

function init(layout) {
  if (['map-point', 'map'].indexOf("{{page.type}}") != -1) {
    generateMap();
  } else {
    generateChart();
  }
}

function generateMap(params, wrapper) {
  var geofile = '{{site.baseurl}}/data/sf_census_tracts.json',
    colors = 'Blues',
    scale = 5;
  var geojson, json, column, d, container, units, mapType, margin, popup, desc, source, notes, legendTitle;
  var overlays = ['{{site.baseurl}}/data/sup_districts.json', '{{site.baseurl}}/data/neighborhoods.json'];

  if (params) {
    mapType = params.type;
    column = params.column;
    desc = params.description;
    source = params.source;
    notes = params.notes;
    popup = params.popup;
    margin = params.margin;
    legendTitle = params.legendTitle;
    d = params.data;
    if (params.colors != '') {
      colors = params.colors
    }
    if (params.scale != '') {
      scale = parseInt(params.scale);
    }
    var container = $('#' + wrapper + ' .map').attr('id');
    units = params.units;
    $('#' + wrapper + ' .chart-wrapper').hide();
    $('#' + wrapper + ' .map-wrapper').show();
  } else {
    mapType = '{{page.type}}';
    column = '{{page.column}}';
    units = '{{page.units}}';
    margin = '{{page.margin}}';
    popup = {{page.popup | jsonify }};
    legendTitle = '{{page.legend-title}}';
    d = "{{page.data}}"; 
    {% if page.colors %}
    var colors = '{{page.colors}}'; 
    {% else %}
    var colors = 'Blues'; 
    {% endif %}
    {% if page.scale %}
    var scale = {{page.scale}}; 
    {% else %}
    var scale = 5; 
    {% endif %}
    var container = 'chart';
  }

  L.mapbox.accessToken = 'pk.eyJ1IjoiZGF0YXNmIiwiYSI6Ilo3bVlHRDQifQ.7gkiPnZtioL8CnCvJ5z9Bg';
  
  if (map) {
    //Todo: find a way to keep the map from reseetting, wasteful to keep loading the same data on every switch
    map.remove();
  }

  map = L.mapbox.map(container, 'datasf.j9b9ihf0').setView([37.767806, -122.438153], 12);
  L.control.fullscreen().addTo(map);

  desc ? $('#' + wrapper + ' .description').html(desc) : '';
  source ? $('#' + wrapper + ' .source').html('<strong>Source:</strong> ' + source) : '';
  notes ? $('#' + wrapper + ' .notes').html('<strong>Notes:</strong> ' + notes) : '';

  if (mapType == "map-point") {
    var markerCats = []; 
    {% if page["legend-cats"] %}
    legendCats = '{{page.legend-cats}}';
    markerCats = legendCats.split(","); 
    {% endif %}

    function bindPointPopup(feature, layer) {
      var popupContent = "<h1 class='popup-title'>" + feature.properties[popup.title] + "</h1>";
      popupContent += "<p>" + feature.properties[popup.subtitle] + "</p>";
      if (Array.isArray(popup.info)) {
        popupContent += "<p>";
        var info = popup.info;
        for (var i = 0; i < info.length; i++) {
          if (feature.properties[info[i]]) {
            popupContent += "<b>" + info[i].replace(/_/g," ").toTitleCase() + "</b>: " + feature.properties[info[i]] + "</br>";
          }
        }
        popupContent += "</p>";
      }
      layer.bindPopup(popupContent);
    }

    var customLayer = function(data) {
      if(!data) {
        data = null;
      }
      return L.geoJson(data, {
      pointToLayer: function(feature, latlng) {
        if (markerCats.indexOf(feature.properties[column]) == -1) {
          markerCats.push(feature.properties[column]);
        }
        return new L.CircleMarker(latlng, {
          radius: 4,
          color: '#000',
          fillColor: getColor(markerCats.indexOf(feature.properties[column]) + 1, markerCats.length < 3 ? 3 : markerCats.length),
          fillOpacity: 1,
          stroke: true,
          weight: 1,
          opacity: .8
        });
      },
      onEachFeature: bindPointPopup
    });
    }

    function setLayers(layers) {
      //Todo: abstract this so that I can pass in names of layers earlier on, for now, these are hard coded
      var baseLayers = {
        "No Overlay": new L.layerGroup(),
        "Supervisor Districts": layers[0],
        "Neighborhoods": layers[1]
      }
      L.control.layers(baseLayers, null).addTo(map);
    }

    //var legend = L.mapbox.legendControl().addLegend(()).addTo(map);

    var layerData;
    
    var csvLocation = (/^https?:\/\//.test(d)) ? d : '{{site.baseurl}}/data/' + d;
    
    var csvLayer;
    
    if(csvLocation.indexOf("json") > -1) {
      $.getJSON(csvLocation, function(json) {
        layerData = toGojson(json,'location');
        csvLayer = customLayer(layerData).addTo(map);
        var legendCont = L.mapbox.legendControl().addLegend(getPointLegendHTML(markerCats)).addTo(map);
        var overlayLayer;
        var overlayLayers = [];
        for (var i = 0; i < overlays.length; i++) {
          (function(i) {
            $.getJSON(overlays[i], function(geodata) {
                geojson = L.geoJson(geodata, {
                  style: {
                    weight: 2,
                    opacity: 0.4,
                    color: '#808080',
                    fillOpacity: 0
                  },
                  onEachFeature: onEachFeature
                });
                overlayLayers[i] = geojson;
              })
              .done(function() {
                if (i = overlays.length - 1) {
                  setLayers(overlayLayers);
                }
              });
          })(i);
        };
      });
    } else {
      //todo: refactor map creation, simplify data processing
    // detect data type, pass data to custom layer and add to map, add legends and bind points (change the way legends are defined), add overlays
  
    var csvLayer = omnivore.csv(csvLocation, null, customLayer())
      .on('ready', function() {
        layerData = csvLayer.toGeoJSON();
        var legendCont = L.mapbox.legendControl().addLegend(getPointLegendHTML(markerCats)).addTo(map);
        var overlayLayer;
        var overlayLayers = [];
        for (var i = 0; i < overlays.length; i++) {
          (function(i) {
            $.getJSON(overlays[i], function(geodata) {
                geojson = L.geoJson(geodata, {
                  style: {
                    weight: 2,
                    opacity: 0.4,
                    color: '#808080',
                    fillOpacity: 0
                  },
                  onEachFeature: onEachFeature
                });
                overlayLayers[i] = geojson;
              })
              .done(function() {
                if (i = overlays.length - 1) {
                  setLayers(overlayLayers);
                }
              });
          })(i);
        };
      })
      .addTo(map);
    }
    

    $('#' + container).on('click', '.legend-item', function(e) {
      $(this).children('.legend-filter').prop('checked') ? $(this).children('.legend-filter').prop('checked', false) : $(this).children('.legend-filter').prop('checked', true);
      $(this).children('i').toggleClass('off');
      var enabled = {};
      $('.legend-filter').each(function(i, el) {
        if ($(el).prop('checked')) enabled[$(el).val()] = true;
      });
      csvLayer.clearLayers();
      csvLayer.options.filter = function(feature, layer) {
        return (feature.properties[column] in enabled);
      }
      csvLayer.addData(layerData);
    });

  } else {
    var autoPopup = new L.Popup({
      autoPan: false
    });
    $.ajax({
      type: "GET",
      url: "{{site.baseurl}}/data/" + d,
      dataType: "text",
      success: function(data) {
        json = scaleData(d3.csv.parse(data));
        $.getJSON(geofile, function(geodata) {
          geodata = addDataToGeoJson(json, geodata)
          geojson = L.geoJson(geodata, {
            style: getStyle,
            onEachFeature: onEachFeature
          }).addTo(map);
          var legendCont = L.mapbox.legendControl().addLegend(getLegendHTML()).addTo(map);
        });
      }
    });
  }

  var valuesOnlyArray;

  function scaleData(data) {
    valuesOnlyArray = extractValuesFromObjectArray(data)
    quantizer = new Quantizer(valuesOnlyArray, scale)
    $.each(data, function(i, dataObject) {
      dataObject.scaledValue = quantizer.quantileNumber(parseFloat(dataObject[column]))
    })
    return data;
  }

  // Function inspired by code in awesome project by Dave Guarino https://github.com/daguar/easy-choropleths
  // Adds `scaled_value` and `value` from data objects into geojson features as, eg, feature.properties.scaled_value
  function addDataToGeoJson(data, geojson) {
    var dataHash = {};
    $.each(data, function(i, dataObject) {
      dataHash[dataObject['GEOID10']] = dataObject;
    });
    $.each(geojson.features, function(i, feature) {
      geoid = feature.properties.GEOID10;
      dataObject = dataHash[geoid];
      if (dataObject && !(isNaN(parseFloat(dataObject[column])))) {
        feature.properties.scaledValue = dataObject.scaledValue;
        feature.properties.value = parseFloat(dataObject[column]);
        if (margin != "") {
          feature.properties.margin = parseFloat(dataObject[margin]);
        }
      } else {
        feature.properties.scaledValue = -1;
        feature.properties.value = -1;
      }
    });
    return geojson;
  }

  function extractValuesFromObjectArray(dataObjectArray) {
    return $.map(dataObjectArray, function(dataObject) {
      return parseFloat(dataObject[column]);
    });
  }

  var min, max;

  function Quantizer(dataArray, s) {
    min = d3.min(dataArray);
    max = d3.max(dataArray);

    this.quantizeNumber = d3.scale.quantize()
      .domain([min, max])
      .range(d3.range(1, s + 1)) // Start with only mapping on 1-5 color scale

    this.quantileNumber = d3.scale.quantile()
      .domain(dataArray)
      .range(d3.range(1, s + 1))
  }

  function getStyle(feature) {
    col = getColor(feature.properties.scaledValue, scale);
    return {
      fillColor: col,
      weight: 2,
      opacity: 0.3,
      color: '#808080',
      fillOpacity: 0.7
    };
  }

  // get color depending on population density value
  function getColor(num, s) {
    if (num === -1) {
      return "transparent";
    }
    return colorbrewer[colors][s][num - 1];
  }

  function onEachFeature(feature, layer) {
    layer.on({
      mousemove: mousemove,
      mouseout: mouseout,
      dblclick: zoomToFeature
    });
  }

  var closeTooltip;

  // control that shows state info on hover
  var info = L.control({
    position: 'bottomleft'
  });

  info.onAdd = function(map) {
    this._div = L.DomUtil.create('div', 'info');
    this.update();
    return this._div;
  };

  info.update = function(props) {
    this._div.innerHTML = (props ?
      '<b>' + props.label + '</b>' : '');
  };

  info.addTo(map);

  map.on('baselayerchange', function(e) {
    e.layer.bringToBack();
  });

  function mousemove(e) {
    var layer = e.target;
    if (mapType != "map-point") {
      var value = "<p>" + layer.feature.properties.value + units + "</p>";
      if (layer.feature.properties.margin) {
        value += "<p>Margin of error: +/-" + layer.feature.properties.margin + "%</p>";
      }
      if (layer.feature.properties.value == -1) {
        value = "No Data";
      }
      autoPopup.setLatLng(e.latlng);
      autoPopup.setContent('<h1 class="popup-title">' + layer.feature.properties.LABEL + '</h2>' +
        "<p>" + value + "</p>");

      if (!autoPopup._map) autoPopup.openOn(map);
      window.clearTimeout(closeTooltip);
    }

    // highlight feature
    layer.setStyle({
      weight: 3,
      opacity: 0.4,
      color: d3.rgb('#808080').darker()
    });

    if (!L.Browser.ie && !L.Browser.opera) {
      layer.bringToBack();
    }

    info.update(layer.feature.properties);
  }

  function mouseout(e) {
    var to = e.originalEvent.toElement
    geojson.resetStyle(e.target);
    if (mapType == 'map') {
      closeTooltip = window.setTimeout(function() {
        map.closePopup();
      }, 100);
    }
    info.update();
  }

  function zoomToFeature(e) {
    if (map.getZoom() >= 12) {
      map.setView(e.latlng, map.getZoom() + 1);
    } else {
      map.fitBounds(e.target.getBounds());
    }
  }

  function getLegendHTML() {
    var legendColors = d3.scale.quantile()
      .domain(valuesOnlyArray)
      .range(colorbrewer[colors][scale]);
    var labels = [];
    for (var i = 0; i < scale; i++) {
      var range = legendColors.invertExtent(colorbrewer[colors][scale][i]);
      from = Math.round(range[0] * 10) / 10;
      to = Math.round(range[1] * 10) / 10;
      labels.push(
        '<i style="background:' + getColor(i + 1, scale) + '"></i> ' +
        from + (to ? '&ndash;' + to : '+') + units);
    }
    legendTitle = (legendTitle == '' ? 'Legend' : legendTitle);
    return '<span><b>' + legendTitle + '</b></span><br>' + labels.join('<br>');
  }

  function getPointLegendHTML(categories) {
    var labels = [];
    var container = $('<div>');
    var title = $('<span>');
    title.html('Legend (click to filter)');
    container.append(title);

    for (var i = 0; i < categories.length; i++) {
      var item = $('<div class="legend-item">');
      var symbol = $('<i>');
      symbol.css("background", getColor(i + 1, categories.length));
      item.append(symbol);

      var checkbox = $('<input class="legend-filter" type="checkbox" id="' + i + '" checked="true" style="display:none;" value="' + categories[i] + '" />');
      item.append(checkbox);

      var label = $('<span>').html(categories[i]);
      item.append(label);

      container.append(item);
      labels.push(label);
    }
    return $('<div>').append(container).html();
  }
}

function isFunction(functionToCheck) {
  var getType = {};
  return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}



function generateChart(params, wrapper) {
  var max = null,
    pleft = null;
    value = [];
  if (params) {
    var data = params.data,
      value = params.chartvalues,
      type = params.type,
      axisType = params["axis-type"],
      yFormat = params["y-format"],
      x = params.column,
      xInputFormat = params.xInputFormat,
      mimeType = params.datatype,
      desc = params.description,
      source = params.source,
      notes = params.notes,
      groups = params.groups,
      emphasis = params.emphasis,
      legend = params.legend,
      max = parseInt(params.max),
      pleft = parseInt(params.pleft);
    $('#' + wrapper + ' .chart-wrapper').show();
    $('#' + wrapper + ' .map-wrapper').hide();
    var container = 'chart';
    var chartcontainer = '#' + wrapper + ' .chart';
  } else {
    var chartcontainer = '#chart';
    var data = '{{page.data}}',
      value = {{ page.chartvalues | jsonify }},
      type = '{{page.type}}',
      mimeType = '{{page.datatype}}',
      axisType = '{{page.axis-type}}',
      {% if page.y-format contains 'function' %}
      yFormat = {{page.y-format}},
      {% else %}
      yFormat = '{{page.y-format}}',
      {% endif %}
      x = '{{page.column}}',
      xInputFormat = '{{page.xInputFormat}}',
      legend = '{{page.legend}}',
      groups = '{{page.groups}}',
      emphasis = '{{page.emphasis}}',
      show = true; 
      {% if page.max %}
      max = {{page.max}}; 
      {% endif %} 
      {% if page.pleft %}
      pleft = {{page.pleft}}; 
      {% endif %}
  }
  
  if (legend == '') {
    legend = 'bottom';
  } else if (legend == 'none') {
    show = false;
    legend = 'bottom';
  }
  var rotated = false;
  if (groups != '') {
    groups = groups.split(',');
  } else {
    groups = [];
  }
  if (type == '') {
    type = 'area';
  } else if (type == 'bar-horizontal') {
    type = 'bar';
    rotated = true;
  }
  if (mimeType == ''){
    mimeType = 'csv';
  }
  
  if (yFormat != '' && !isFunction(yFormat)) {
    yFormat = d3.format(yFormat);
  }

  
  if (axisType == 'timeseries') {
    xFormat = '%m/%d/%Y';
  } else {
    xFormat = '';
  }
  
  if(xInputFormat == '') {
    xInputFormat = "%Y-%m-%d";
  }

  desc ? $('#' + wrapper + ' .description').html(desc) : '';
  source ? $('#' + wrapper + ' .source').html('<strong>Source:</strong> ' + source) : '';
  notes ? $('#' + wrapper + ' .notes').html('<strong>Notes:</strong> ' + notes) : '';

  emphasis = (emphasis != '' ? emphasis.split(",") : [null, null, null]);

  function tooltip_contents(d, defaultTitleFormat, defaultValueFormat, color) {
    var $$ = this,
      config = $$.config,
      CLASS = $$.CLASS,
      titleFormat = config.tooltip_format_title || defaultTitleFormat,
      nameFormat = config.tooltip_format_name || function(name) {
        return name;
      },
      valueFormat = config.tooltip_format_value || defaultValueFormat,
      text, i, title, value, name, bgcolor;

    // You can access all of data like this:
    var allData = $$.data.targets;

    for (i = 0; i < d.length; i++) {
      if (!(d[i] && (d[i].value || d[i].value === 0))) {
        continue;
      }

      if (!text) {
        title = titleFormat ? titleFormat(d[i].x) : d[i].x;
        text = "<table class='" + CLASS.tooltip + "'>" + (title || title === 0 ? "<tr><th colspan='2'>" + title + "</th></tr>" : "");
      }

      name = nameFormat(d[i].name);
      value = valueFormat(d[i].value, d[i].ratio, d[i].id, d[i].index);
      if ((typeof allData[i + i + 1] != "undefined") && allData[i + i + 1].id.indexOf("MOE") > -1) {
        value += " +/-" + valueFormat(allData[i + i + 1].values[d[i].index].value);
      }
      bgcolor = $$.levelColor ? $$.levelColor(d[i].value) : color(d[i].id);

      text += "<tr class='" + CLASS.tooltipName + "-" + d[i].id + "'>";
      text += "<td class='name'><span style='background-color:" + bgcolor + "'></span>" + name + "</td>";
      text += "<td class='value'>" + value + "</td>";
      text += "</tr>";
    }
    return text + "</table>";
  }
  
  //todo: abstract the data call across charts/maps
  var url = (/^https?:\/\//.test(data)) ? data : '{{site.baseurl}}/data/' + data;
  var names = {};
  if (value) {
    value.forEach(function(v) {
      name = v.replace(/_/g," ");
      names[v] = name.toTitleCase();
    })
  }
  
  var chart = c3.generate({
    bindto: chartcontainer,
    padding: {
      bottom: 30,
      left: pleft
    },
    data: {
      url: url,
      x: x,
      xFormat: xInputFormat,
      mimeType: mimeType,
      keys: {
        x: x,
        value: value
      },
      names: names,
      groups: [groups],
      type: type,
      color: function(color, d) {
        return d.id && d.index == emphasis[1] && d.id == emphasis[0] ? d3.rgb('#' + emphasis[2]) : color;
      },
      order: null,
      hide: ["MOE", "MOE_Renter", "MOE_Owner", "MOE_More", "MOE_Less"]
    },
    tooltip: {
      contents: tooltip_contents
    },
    color: {
      pattern: ['#5a9bd4', '#7ac36a', '#faa75b', '#9e67ab', '#ce7058', '#d77fb4', '#f15a60', '#737373']
    },
    legend: {
      position: legend,
      show: show,
      hide: ["MOE", "MOE_Renter", "MOE_Owner", "MOE_More", "MOE_Less"]
    },
    axis: {
      rotated: rotated,
      x: {
        type: axisType,
        tick: {
          format: xFormat,
          width: 150
        }
      },
      y: {
        min: 0,
        max: max,
        padding: {
          bottom: 0,
          top: 3
        },
        tick: {
          format: yFormat
        }
      }
    }
  });

  /*chart.hide(['MOE','MOE_Renter','MOE_Owner'],{withLegend: true});*/
}

function toGeojson(json, locationField) {
  if (!json || !json.length) {
    console.log('Failed to get data');
  }
  else {
    var geojson = {
      type: 'FeatureCollection',
      features: []
    };
    var geojsonFeature;
    json.forEach(function(feature, i) {
      geojsonFeature = {
        type: 'Feature',
        geometry: {},
        id: i + 1
      };
      if (feature && locationField) {
        if (feature[locationField] && feature[locationField].latitude && feature[locationField].longitude) {
          geojsonFeature.geometry.coordinates = [parseFloat(feature[locationField].longitude), parseFloat(feature[locationField].latitude)];
          geojsonFeature.geometry.type = 'Point';
          delete feature.location;
          geojsonFeature.properties = feature;
          geojson.features.push(geojsonFeature);
        }
      }
      else if (feature && feature.latitude && feature.longitude) {
        geojsonFeature.geometry.coordinates = [parseFloat(feature.longitude), parseFloat(feature.latitude)];
        geojsonFeature.geometry.type = 'Point';
        geojsonFeature.properties = feature;
        geojson.features.push(geojsonFeature);
      }
      else {
        geojsonFeature.geometry = null;
        geojsonFeature.properties = feature;
        geojson.features.push(geojsonFeature);
      }
    });
    return geojson;
  }
};