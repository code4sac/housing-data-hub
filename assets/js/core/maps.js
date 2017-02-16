var hubMap = {
  version: ".1"
};

function HubMap(options) {
  this.options = options;
  this.data = "";
  this.map = false;
  this.legend = "";
  this.options.scale = (options.scale !== "" ? parseInt(options.scale) : null);
  this.options.legendCategories = options.legendCategories || [];
  this.baseLayer = "";
  this.valuesOnlyArray = [];
  /* default overlays */
  this.overlays = ['/housing-data-hub/data-browser/data/sup_districts.json', '/housing-data-hub/data-browser/data/neighborhoods.json'];
  this.overlayData = [];
  this.overlayTemplate = "";
}

HubMap.prototype.getMap = function() {
  return this.map
}

/*
Load and process data for use in the map
*/
HubMap.prototype.loadData = function() {
  var $$ = this, options = $$.options;
  var data = (/^https?:\/\//.test(options.data)) ? options.data : '/housing-data-hub/data-browser/data/' + options.data;
  $$.options.dataType = (data.indexOf("geojson") > -1 ? "geojson" : data.indexOf("json") > -1 ? "json" : data.indexOf("csv") > -1 ? "csv" : false);
  if(!options.dataType) {
    throw new Error('Data is not one of either json, geojson or csv');
  }
  
  if(options.type == 'map-point') {
    $$.getOverlayData(function() {
      if(options.dataType == 'geojson') {
        $.getJSON(data, function(geojson) {
          $$.data = geojson;
          $$.render();
        });
      } else if(options.dataType == 'csv') {
        var layer = omnivore.csv(data).on('ready',function() {
          $$.data = layer.toGeoJSON();
          $$.render();
        });
      }
    });
  } else if(options.type == 'map') {
    $.ajax({
      type: "GET",
      url: data,
      dataType: "text",
      success: function(data) {
        json = scaleData(d3.csv.parse(data));
        $.getJSON('/housing-data-hub/data-browser/data/SacTracts.json', function(geodata) {
          $$.data = addDataToGeoJson(json, geodata);
          $$.render();
        });
      }
    });
  }

  function scaleData(data) {
    $$.valuesOnlyArray = extractValuesFromObjectArray(data);
    quantizer = new Quantizer($$.valuesOnlyArray, options.scale);
    $.each(data, function(i, dataObject) {
      dataObject.scaledValue = quantizer.quantileNumber(parseFloat(dataObject[options.x]));
    });
    return data;
  }

  function extractValuesFromObjectArray(dataObjectArray) {
    return $.map(dataObjectArray, function(dataObject) {
      return parseFloat(dataObject[options.x]);
    });
  }

  function Quantizer(dataArray, s) {
    var min = d3.min(dataArray);
    var max = d3.max(dataArray);

    this.quantizeNumber = d3.scale.quantize()
    .domain([min, max])
      .range(d3.range(1, s + 1)); // Start with only mapping on 1-5 color scale

      this.quantileNumber = d3.scale.quantile()
      .domain(dataArray)
      .range(d3.range(1, s + 1));
    }

    function addDataToGeoJson(data, geojson) {
      var column = options.x, margin = options.margin;
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
          feature.properties.scale = parseInt(options.scale);
          if (margin !== "") {
            feature.properties.margin = parseFloat(dataObject[margin]);
          }
        } else {
          feature.properties.scaledValue = -1;
          feature.properties.value = -1;
          feature.properties.scale = parseInt(options.scale);
        }
      });
      return geojson;
    }

  };

  /*
  Render the map
  */
  HubMap.prototype.render = function() {
    var $$ = this, options = $$.options, closeTooltip;
    var popup = options.popup,
    column = options.x,
    colors = options.colors;

    var onEachFeature = function(feature, layer) {
      layer.on({
        mousemove: mousemove,
        mouseout: mouseout,
        dblclick: zoomToFeature
      });
    }

    L.mapbox.accessToken = 'pk.eyJ1IjoibDg0dGFoZSIsImEiOiI0NTZiYzQyYWYxMTM0YzhiOGVlNTMzZTIyOTEzNGM1MCJ9.LYHXE9Ky_Y-Wx5llO49zBA';
    /* initialize map and extra controls */
    var z = options.zoom || 11
    $$.map = L.mapbox.map($$.options.container, 'datasf.j9b9ihf0').setView([38.563068, -121.474505], z);
    L.control.fullscreen().addTo($$.map);
    /* add base layer: this can be abstracted further to just pass in geojson data and layer function */
    if(options.type == 'map-point') { 
      $$.baseLayer = customLayer($$.data).addTo($$.map);
      setOverlayLayers();
    } else if(options.type == 'map') {
      if(options.dataType == 'csv') {
        $$.baseLayer = L.geoJson($$.data, {
          style: getStyle,
          onEachFeature: onEachFeature
        }).addTo($$.map);
        var autoPopup = new L.Popup({
          autoPan: false
        });
      }
    }
    if(!$$.options.legendCategories) {
      $$.buildLegend();
      $$.map.legendControl.addLegend($$.legend);
    }
    $$.bindInteractive();

    var info = L.control({
      position: 'bottomleft'
    });

    info.onAdd = function(map) {
      this._div = L.DomUtil.create('div', 'info');
      this.update();
      return this._div;
    };

    info.update = function(props) {
      this._div.innerHTML = (props && props.label ? '<b>' + props.label + '</b>' : '');
    };

    info.addTo($$.map);

    function customLayer(data) {
      if(!data) {
        data = null;
      }
      return L.geoJson(data, {
        pointToLayer: function(feature, latlng) {
          if ($$.options.legendCategories.indexOf(feature.properties[column]) == -1) {
            $$.options.legendCategories.push(feature.properties[column]);
          }
          return new L.CircleMarker(latlng, {
            radius: 4,
            color: '#000',
            fillColor: $$.getColor($$.options.legendCategories.indexOf(feature.properties[column]) + 1, $$.options.legendCategories.length < 3 ? 3 : $$.options.legendCategories.length),
            fillOpacity: 1,
            stroke: true,
            weight: 1,
            opacity: .8
          });
        },
        onEachFeature: bindPointPopup
      });
    }

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

    function getStyle(feature) {
      var color = $$.getColor(feature.properties.scaledValue, feature.properties.scale);
      return {
        fillColor: color,
        weight: 2,
        opacity: 0.3,
        color: '#808080',
        fillOpacity: 0.7
      };
    }

    function mousemove(e) {
      var layer = e.target;
      if (options.type != 'map-point') {
        var value = "<p>" + layer.feature.properties.value + options.units + "</p>";
        if (layer.feature.properties.margin) {
          value += "<p>Margin of error: +/-" + layer.feature.properties.margin + "%</p>";
        }
        if (layer.feature.properties.value == -1) {
          value = "No Data";
        }
        autoPopup.setLatLng(e.latlng);
        autoPopup.setContent('<h1 class="popup-title">' + layer.feature.properties.LABEL + '</h2>' +
          "<p>" + value + "</p>");

        if (!autoPopup._map) autoPopup.openOn($$.map);
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
    var to = e.originalEvent.toElement;
    if(options.type == 'map') {
      $$.baseLayer.resetStyle(e.target);
    } else {
      $$.overlayTemplate.resetStyle(e.target);
    }
    if (options.type == 'map') {
      closeTooltip = window.setTimeout(function() {
        $$.map.closePopup();
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

  function setOverlayLayers() {
      //Todo: abstract this so that I can pass in names of layers earlier on, for now, these are hard coded
      var baseDefinition = {
        style: {
          weight: 2,
          opacity: 0.4,
          color: '#808080',
          fillOpacity: 0
        },
        onEachFeature: onEachFeature
      }
      
      var overlayLayers = {
        "No Overlay": new L.layerGroup(),
        "Supervisor Districts": new L.geoJson($$.overlayData[0], baseDefinition),
        "Neighborhoods": new L.geoJson($$.overlayData[1], baseDefinition)
      }

      $$.overlayTemplate = new L.geoJson($$.overlayData[1], baseDefinition);
      
      L.control.layers(overlayLayers, null).addTo($$.map);
    }
  };

  /*
  Get color from colorbrewer
  */

  HubMap.prototype.getColor = function(num,s) {
    if (num === -1) {
      return "transparent";
    }
    return colorbrewer[this.options.colors][s][num - 1];

  };

  /*
  Generate and set the legend
  */
  HubMap.prototype.buildLegend = function() {
    var $$ = this, options = $$.options,
    categories = $$.options.legendCategories, colors = options.colors, scale = options.scale;
    if(options.type == 'map-point') {
      var labels = [];
      var container = $('<div>');
      var title = $('<span>');
      title.html('<b>Legend (click to filter)</b>');
      container.append(title);

      for (var i = 0; i < categories.length; i++) {
        var item = $('<div class="legend-item">');
        var symbol = item.append($('<i>').css("background", $$.getColor(i + 1, categories.length)));
        var checkbox = item.append($('<input class="legend-filter" type="checkbox" id="' + i + '" checked="true" style="display:none;" value="' + categories[i] + '" />'));
        var label = $('<span>').html(categories[i]);
        item.append(label);

        container.append(item);
        labels.push(label);
      }
      $$.legend = $('<div>').append(container).html();
      return this;
    } else {
      var legendColors = d3.scale.quantile()
      .domain($$.valuesOnlyArray)
      .range(colorbrewer[colors][scale]);
      var labels = [];
      for (var i = 0; i < scale; i++) {
        var range = legendColors.invertExtent(colorbrewer[colors][scale][i]);
        from = Math.round(range[0] * 10) / 10;
        to = Math.round(range[1] * 10) / 10;
        labels.push(
          '<i style="background:' + $$.getColor(i + 1, scale) + '"></i> ' +
          from + (to ? '&ndash;' + to : '+') + options.units);
      }
      var legendTitle = (options.legendTitle == '' ? 'Legend' : options.legendTitle);
      $$.legend = '<span><b>' + legendTitle + '</b></span><br>' + labels.join('<br>');
      return this;
    }
  };

  HubMap.prototype.getOverlayData = function(cb) {
    $$ = this, options = $$.options;
    for (var i = 0; i < $$.overlays.length; i++) {
      (function(i) {
        $.getJSON($$.overlays[i], function(geojson) {
          $$.overlayData[i] = geojson;
        }).done(function() {
          if(i == $$.overlays.length - 1) {
            cb();
          }
        });
      })(i);
    }
  }

  HubMap.prototype.bindInteractive = function() {
    var $$ = this, options = $$.options;
    $('#' + options.container).off('click').on('click', '.legend-item', function(e) {
      $(this).children('.legend-filter').prop('checked') ? $(this).children('.legend-filter').prop('checked', false) : $(this).children('.legend-filter').prop('checked', true);
      $(this).children('i').toggleClass('off');
      var enabled = {};
      $('.legend-filter').each(function(i, el) {
        if ($(el).prop('checked')) enabled[$(el).val()] = true;
      });
      $$.baseLayer.clearLayers();
      $$.baseLayer.options.filter = function(feature, layer) {
        return (feature.properties[options.x] in enabled);
      }
      $$.baseLayer.addData($$.data);
    });
  }

  hubMap.generate = function(options, container) {
    if (container) {
      options.container = container;
    }
    var hubMap = new HubMap(options);
    hubMap.loadData();
    return hubMap
  }