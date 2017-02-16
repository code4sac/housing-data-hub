var hubChart = {
  version: ".1"
};

function HubChart(options) {
  this.options = options;
  this.data = "";
  this.loadData();
}

HubChart.prototype.getOption = function(key) {
  return this.options[key];
}

HubChart.prototype.setOption = function(key, value) {
  return this.options[key] = value;
}

HubChart.prototype.loadData = function() {
  $$ = this;
  if ($$.options.mimeType === "json") {
    $.ajax({
      url: $$.options.data,
      type: 'GET',
      success: function(response) {
        if ($$.options.transform !== "") {
          var transformer = new Transformer();
          var transform = new window[$$.options.transform];
          if (typeof transform === "object") {
            transformer.setTransform(transform);
            response = transformer.run(response, $$);
          }
          else {
            throw new Error('transformer does not exist for ' + this.options.chartTitle);
          }
        }
        $$.data = response;
        $$.render();
      }
    });
  }
  else {
    $$.data = $$.options.data;
    $$.render();
  }
};

HubChart.prototype.render = function() {
  /*
  initiate defaults
  */

  var options = this.options,
    data = this.data,
    max = null,
    pleft = null,
    show = true,
    rotated = false,
    names = {},
    legend = 'bottom',
    type = 'area',
    mimeType = 'csv';

  /* detect whether the data is being passed via external url */
  if (typeof data === "string") {
    var url = (/^https?:\/\//.test(data)) ? data : '/data-browser/data/' + data;
  }
  /* define derived variables based on input options */
  show = options.legend == 'none' ? false : true;
  rotated = options.type == 'bar-horizontal' ? true : false;
  /* redefine certain parameters */
  options.legend = options.legend == '' ? legend : options.legend;
  options.groups = options.groups == null ? [] : options.groups;
  options.type = options.type == '' ? type : (options.type == 'bar-horizontal' ? 'bar' : options.type);
  options.mimeType = options.mimeType == '' ? mimeType : options.mimeType;
  options.yFormat = (Object.prototype.toString.call(options.yFormat) === '[object Function]') ? options.yFormat : d3.format(options.yFormat);
  options.emphasis = options.emphasis == null ? [null, null, null] : options.emphasis;
  /* 
  generate names from chart values to make them human friendly
  - remove underscores
  - title case
  */
  if (options.value) {
    options.value.forEach(function(v, idx) {
      names[v] = (options.names ? options.names[idx] : v.replace(/_/g, " ").toTitleCase());
    });
  }

  /* override tooltips to include Margins of Error where applicable*/
  var tooltip_contents = function(d, defaultTitleFormat, defaultValueFormat, color) {
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
      
      if (config.data_type === 'donut' || config.data_type === 'pie') {
        var formatComma = d3.format(",")
        value = formatComma(d[i].value)
      }
      
      bgcolor = $$.levelColor ? $$.levelColor(d[i].value) : color(d[i].id);

      text += "<tr class='" + CLASS.tooltipName + "-" + d[i].id + "'>";
      text += "<td class='name'><span style='background-color:" + bgcolor + "'></span>" + name + "</td>";
      text += "<td class='value'>" + value + "</td>";
      text += "</tr>";
    }
    return text + "</table>";
  };

  var chart = c3.generate({
    bindto: '#' + options.container,
    padding: {
      bottom: 30,
      left: pleft
    },
    data: {
      x: options.x,
      xFormat: options.xFormat,
      url: url || undefined,
      json: (Object.prototype.toString.call(data[0]) === '[object Object]' ? data : undefined),
      columns: (Object.prototype.toString.call(data[0]) === '[object Array]' ? data : undefined),
      mimeType: options.mimeType,
      keys: {
        x: options.x,
        value: options.value
      },
      names: names,
      groups: [options.groups],
      type: options.type,
      color: function(color, d) {
        return d.id && d.index == options.emphasis[1] && d.id == options.emphasis[0] ? d3.rgb('#' + options.emphasis[2]) : color;
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
      position: options.legend,
      show: show,
      hide: ["MOE", "MOE_Renter", "MOE_Owner", "MOE_More", "MOE_Less"]
    },
    axis: {
      rotated: rotated,
      x: {
        label: {
          text: options.xLabel || null,
          position: 'outer-center'
        },
        type: options.axisType,
        tick: {
          format: options.xTickFormat,
          width: 150
        }
      },
      y: {
        label: {
          text: options.yLabel || null,
          position: 'outer-middle'
        },
        min: 0,
        max: max,
        padding: {
          bottom: 0,
          top: 3
        },
        tick: {
          format: options.yFormat
        }
      }
    }
  });
};

hubChart.generate = function(options, container) {
  if (container) {
    options.container = container;
  }
  return new HubChart(options);
};
