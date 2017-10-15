// ==UserScript==
// @id             iitc-plugin-cross-links@mcben
// @name           IITC plugin: cross links
// @category       Layer
// @version        1.1.2.@@DATETIMEVERSION@@
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      @@UPDATEURL@@
// @downloadURL    @@DOWNLOADURL@@
// @description    [@@BUILDNAME@@-@@BUILDDATE@@] EXPERIMENTAL: Checks for existing links that cross planned links. Requires draw-tools plugin.
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @include        https://*.ingress.com/mission/*
// @include        http://*.ingress.com/mission/*
// @match          https://*.ingress.com/mission/*
// @match          http://*.ingress.com/mission/*
// @grant          none
// ==/UserScript==

@@PLUGINSTART@@

// PLUGIN START ////////////////////////////////////////////////////////


window.plugin.crossLinks = function() {};

window.plugin.crossLinks.currentMatchColor = '#a24ac3';

window.plugin.crossLinks.greatCircleArcIntersect = function(a0,a1,b0,b1) {
  // based on the formula at http://williams.best.vwh.net/avform.htm#Int

  // method:
  // check to ensure no line segment is zero length - if so, cannot cross
  // check to see if either of the lines start/end at the same point. if so, then they cannot cross
  // check to see if the line segments overlap in longitude. if not, no crossing
  // if overlap, clip each line to the overlapping longitudes, then see if latitudes cross 

  // anti-meridian handling. this code will not sensibly handle a case where one point is
  // close to -180 degrees and the other +180 degrees. unwrap coordinates in this case, so one point
  // is beyond +-180 degrees. this is already true in IITC
  // FIXME? if the two lines have been 'unwrapped' differently - one positive, one negative - it will fail

  // zero length line tests
  if (a0.equals(a1)) return false;
  if (b0.equals(b1)) return false;

  // lines have a common point
  if (a0.equals(b0) || a0.equals(b1)) return false;
  if (a1.equals(b0) || a1.equals(b1)) return false;


  // check for 'horizontal' overlap in lngitude
  if (Math.min(a0.lng,a1.lng) > Math.max(b0.lng,b1.lng)) return false;
  if (Math.max(a0.lng,a1.lng) < Math.min(b0.lng,b1.lng)) return false;


  // ok, our two lines have some horizontal overlap in longitude
  // 1. calculate the overlapping min/max longitude
  // 2. calculate each line latitude at each point
  // 3. if latitudes change place between overlapping range, the lines cross


  // class to hold the pre-calculated maths for a geodesic line
  // TODO: move this outside this function, so it can be pre-calculated once for each line we test
  var GeodesicLine = function(start,end) {
    var d2r = Math.PI/180.0;
    var r2d = 180.0/Math.PI;

    // maths based on http://williams.best.vwh.net/avform.htm#Int

    if (start.lng == end.lng) {
      throw 'Error: cannot calculate latitude for meridians';
    }

    // only the variables needed to calculate a latitude for a given longitude are stored in 'this'
    this.lat1 = start.lat * d2r;
    this.lat2 = end.lat * d2r;
    this.lng1 = start.lng * d2r;
    this.lng2 = end.lng * d2r;

    var dLng = this.lng1-this.lng2;

    var sinLat1 = Math.sin(this.lat1);
    var sinLat2 = Math.sin(this.lat2);
    var cosLat1 = Math.cos(this.lat1);
    var cosLat2 = Math.cos(this.lat2);

    this.sinLat1CosLat2 = sinLat1*cosLat2;
    this.sinLat2CosLat1 = sinLat2*cosLat1;

    this.cosLat1CosLat2SinDLng = cosLat1*cosLat2*Math.sin(dLng);
  }

  GeodesicLine.prototype.isMeridian = function() {
    return this.lng1 == this.lng2;
  }

  GeodesicLine.prototype.latAtLng = function(lng) {
    lng = lng * Math.PI / 180; //to radians

    var lat;
    // if we're testing the start/end point, return that directly rather than calculating
    // 1. this may be fractionally faster, no complex maths
    // 2. there's odd rounding issues that occur on some browsers (noticed on IITC MObile) for very short links - this may help
    if (lng == this.lng1) {
      lat = this.lat1;
    } else if (lng == this.lng2) {
      lat = this.lat2;
    } else {
      lat = Math.atan ( (this.sinLat1CosLat2*Math.sin(lng-this.lng2) - this.sinLat2CosLat1*Math.sin(lng-this.lng1))
                       / this.cosLat1CosLat2SinDLng);
    }
    return lat * 180 / Math.PI; // return value in degrees
  }



  // calculate the longitude of the overlapping region
  var leftLng = Math.max( Math.min(a0.lng,a1.lng), Math.min(b0.lng,b1.lng) );
  var rightLng = Math.min( Math.max(a0.lng,a1.lng), Math.max(b0.lng,b1.lng) );

  // calculate the latitudes for each line at left + right longitudes
  // NOTE: need a special case for meridians - as GeodesicLine.latAtLng method is invalid in that case
  var aLeftLat, aRightLat;
  if (a0.lng == a1.lng) {
    // 'left' and 'right' now become 'top' and 'bottom' (in some order) - which is fine for the below intersection code
    aLeftLat = a0.lat;
    aRightLat = a1.lat;
  } else {
    var aGeo = new GeodesicLine(a0,a1);
    aLeftLat = aGeo.latAtLng(leftLng);
    aRightLat = aGeo.latAtLng(rightLng);
  }

  var bLeftLat, bRightLat;
  if (b0.lng == b1.lng) {
    // 'left' and 'right' now become 'top' and 'bottom' (in some order) - which is fine for the below intersection code
    bLeftLat = b0.lat;
    bRightLat = b1.lat;
  } else {
    var bGeo = new GeodesicLine(b0,b1);
    bLeftLat = bGeo.latAtLng(leftLng);
    bRightLat = bGeo.latAtLng(rightLng);
  }

  // if both a are less or greater than both b, then lines do not cross

  if (aLeftLat < bLeftLat && aRightLat < bRightLat) return false;
  if (aLeftLat > bLeftLat && aRightLat > bRightLat) return false;

  // latitudes cross between left and right - so geodesic lines cross
  return true;
}



window.plugin.crossLinks.testPolyLine = function (polyline, link,closed) {

    var a = link.getLatLngs();
    var b = polyline.getLatLngs();

    for (var i=0;i<b.length-1;++i) {
        if (window.plugin.crossLinks.greatCircleArcIntersect(a[0],a[1],b[i],b[i+1])) return true;
    }

    if (closed) {
        if (window.plugin.crossLinks.greatCircleArcIntersect(a[0],a[1],b[b.length-1],b[0])) return true;
    }

    return false;
}

window.plugin.crossLinks.testPolyLineAgainstPolyLine = function (polyline1, polyline2, firstClosed, secondClosed) {

    var a = polyline1.getLatLngs();
    var b = polyline2.getLatLngs();

    for (var i=0;i<a.length-1;++i) {
        for (var j=0;j<b.length-1;++j) {
            if (window.plugin.crossLinks.greatCircleArcIntersect(a[i],a[i+1],b[j],b[j+1])) return true;

            if (firstClosed) 
                if (window.plugin.crossLinks.greatCircleArcIntersect(a[a.length-1],a[0],b[j],b[j+1])) return true;
        }

        if (secondClosed) 
            if (window.plugin.crossLinks.greatCircleArcIntersect(a[i],a[i+1],b[b.length-1],b[0])) return true;
    }

    if (firstClosed && secondClosed) 
        if (window.plugin.crossLinks.greatCircleArcIntersect(a[a.length-1],a[0],b[b.length-1],b[0])) return true;

    return false;
}

window.plugin.crossLinks.onLinkAdded = function (data) {
    if (!window.plugin.crossLinks.disabled);
        plugin.crossLinks.testLink(data.link);
}

window.plugin.crossLinks.checkAllLinks = function() {
    if (window.plugin.crossLinks.disabled) return;

    console.debug("Cross-Links: checking all links");
    plugin.crossLinks.linkLayer.clearLayers();
    plugin.crossLinks.linkLayerGuids = {};
	plugin.crossLinks.updateCount();

    $.each(window.links, function(guid, link) {
        plugin.crossLinks.testLink(link);
    });
}

window.plugin.crossLinks.testLink = function (link) {
    if (plugin.crossLinks.linkLayerGuids[link.options.guid]) return;

    for (var i in plugin.drawTools.drawnItems._layers) { // leaflet don't support breaking out of the loop
       var layer = plugin.drawTools.drawnItems._layers[i];
       if (layer instanceof L.GeodesicPolygon && layer.options.color == window.plugin.crossLinks.currentMatchColor) {
           if (plugin.crossLinks.testPolyLine(layer, link,true)) {
               plugin.crossLinks.showLink(link);
               break;
           }
        } else if (layer instanceof L.GeodesicPolyline && layer.options.color == window.plugin.crossLinks.currentMatchColor) {
            if (plugin.crossLinks.testPolyLine(layer, link)) {
                plugin.crossLinks.showLink(link);
                break;
            }
        }
    };
}


window.plugin.crossLinks.showLink = function(link) {

    var poly = L.geodesicPolyline(link.getLatLngs(), {
       color: '#d22',
       opacity: 0.7,
       weight: 5,
       clickable: false,
       dashArray: [8,8],

       guid: link.options.guid
    });

    poly.addTo(plugin.crossLinks.linkLayer);
    plugin.crossLinks.linkLayerGuids[link.options.guid]=poly;
	window.plugin.crossLinks.updateCount();
}

window.plugin.crossLinks.showLayersIntersection = function(layer1, layer2) {
    if(window.plugin.crossLinks.crossLayersIntersections.indexOf([layer1, layer2]) > 0 ||
       window.plugin.crossLinks.crossLayersIntersections.indexOf([layer2, layer1]) > 0)
        return;

    var layers = [layer1, layer2];
    window.plugin.crossLinks.crossLayersIntersections.push(layers);
    for (var i = 0; i < 2; i++) {
        var layer = layers[i];
        if(plugin.crossLinks.crossLayersLayer.hasLayer(layer))
            return;

        if (layer instanceof L.GeodesicPolygon) {
            var poly = L.geodesicPolygon(layer.getLatLngs(), {
               color: '#d22',
               opacity: 0.7,
               fill: false,
               weight: 5,
               clickable: false,
               dashArray: [8,8],
            });
        } else {
            var poly = L.geodesicPolyline(layer.getLatLngs(), {
               color: '#d22',
               opacity: 0.7,
               weight: 5,
               clickable: false,
               dashArray: [8,8],
            });
        }

        poly.addTo(plugin.crossLinks.crossLayersLayer);
    }; 
}

window.plugin.crossLinks.removeLayersIntersection = function(layer1, layer2) {
    var intersectionIndex = window.plugin.crossLinks.crossLayersIntersections.indexOf([layer1, layer2]);
    if(intersectionIndex < 0)
       intersectionIndex = window.plugin.crossLinks.crossLayersIntersections.indexOf([layer2, layer1]);
    if(intersectionIndex < 0)
        return;

    window.plugin.crossLinks.crossLayersIntersections.splice(intersectionIndex, 1);
    var removeLayer = [ true, true ];
    for(var i = 0; i < window.plugin.crossLinks.crossLayersIntersections.length; i++) {
        var intersection = window.plugin.crossLinks.crossLayersIntersections[i];
        if(intersection[0] === layer1 || intersection[1] === layer1)
            removeLayer[0] = false;
        if(intersection[0] === layer2 || intersection[1] === layer1)
            removeLayer[1] = false;

        if (!removeLayer[0] && !removeLayer[1])
            break;
    }

    if (removeLayer[0]) 
        window.plugin.crossLinks.crossLayersLayer.removeLayer(layer1);
    if (removeLayer[1]) 
        window.plugin.crossLinks.crossLayersLayer.removeLayer(layer2);
}

window.plugin.crossLinks.onMapDataRefreshEnd = function () {
    if (!window.plugin.crossLinks.disabled) {
        window.plugin.crossLinks.linkLayer.bringToFront();

        window.plugin.crossLinks.testForDeletedLinks();
    }

    if (!window.plugin.crossLinks.crossLayersDisabled) {
        window.plugin.crossLinks.testCrossLayers();
        window.plugin.crossLinks.crossLayersLayer.bringToFront();
    }
}

window.plugin.crossLinks.testAllLinksAgainstLayer = function (layer) {
    if (window.plugin.crossLinks.disabled) return;

    $.each(window.links, function(guid, link) {
        if (!plugin.crossLinks.linkLayerGuids[link.options.guid])
        {
            if (layer instanceof L.GeodesicPolygon && layer.options.color == window.plugin.crossLinks.currentMatchColor) {
                if (plugin.crossLinks.testPolyLine(layer, link,true)) {
                    plugin.crossLinks.showLink(link);
                }
            } else if (layer instanceof L.GeodesicPolyline && layer.options.color == window.plugin.crossLinks.currentMatchColor) {
                if (plugin.crossLinks.testPolyLine(layer, link)) {
                    plugin.crossLinks.showLink(link);
                }
            }
        }
    });
}

window.plugin.crossLinks.testCrossLayers = function (layer) {
    if (window.plugin.crossLinks.crossLayersDisabled) return;

    if (!layer)
        plugin.crossLinks.crossLayersLayer.clearLayers();
    
    for (var i in plugin.drawTools.drawnItems._layers) {
        var layer1 = plugin.drawTools.drawnItems._layers[i];
        var layer1Closed = false;
        if (layer1 instanceof L.GeodesicPolygon) 
            layer1Closed = true;

        if (layer) {
            var layerClosed = false;
            if (layer instanceof L.GeodesicPolygon) 
                layerClosed = true;

            if (plugin.crossLinks.testPolyLineAgainstPolyLine(layer1, layer, layer1Closed, layerClosed)) 
                plugin.crossLinks.showLayersIntersection(layer1, layer);
            else
                plugin.crossLinks.removeLayersIntersection(layer1, layer);
        } else {
            for (var j in plugin.drawTools.drawnItems._layers) {
                if(i == j) continue;

                var layer2 = plugin.drawTools.drawnItems._layers[j];
                var layer2Closed = false;

                if (layer2 instanceof L.GeodesicPolygon) 
                    layer2Closed = true;

                if (plugin.crossLinks.testPolyLineAgainstPolyLine(layer1, layer2, layer1Closed, layer2Closed)) 
                    plugin.crossLinks.showLayersIntersection(layer1, layer2);
            }
        }
    }
}

window.plugin.crossLinks.testForDeletedLinks = function () {
    window.plugin.crossLinks.linkLayer.eachLayer( function(layer) {
        var guid = layer.options.guid;
        if (!window.links[guid]) {
            console.log("link removed");
            plugin.crossLinks.linkLayer.removeLayer(layer);
            delete plugin.crossLinks.linkLayerGuids[guid];
            window.plugin.crossLinks.updateCount();
        }
    });
}

window.plugin.crossLinks.createLayer = function() {
    window.plugin.crossLinks.linkLayer = new L.FeatureGroup();
    window.plugin.crossLinks.linkLayerGuids={};
    window.addLayerGroup('Cross Links', window.plugin.crossLinks.linkLayer, true);
    window.plugin.crossLinks.crossLayersIntersections = [];
    window.plugin.crossLinks.crossLayersLayer = new L.FeatureGroup();
    window.addLayerGroup('Cross Layers', window.plugin.crossLinks.crossLayersLayer, true);

    map.on('layeradd', function(obj) {
      if(obj.layer === window.plugin.crossLinks.linkLayer) {
        delete window.plugin.crossLinks.disabled;
        window.plugin.crossLinks.checkAllLinks();
      } else if(obj.layer === window.plugin.crossLinks.crossLayersLayer) {
        delete window.plugin.crossLinks.crossLayersDisabled;
        window.plugin.crossLinks.testCrossLayers();
      }
    });
    map.on('layerremove', function(obj) {
      if(obj.layer === window.plugin.crossLinks.linkLayer) {
        window.plugin.crossLinks.disabled = true;
        window.plugin.crossLinks.linkLayer.clearLayers();
        plugin.crossLinks.linkLayerGuids = {};
      } else if(obj.layer === window.plugin.crossLinks.crossLayersLayer) {
        window.plugin.crossLink.crossLayersDisabled = true;
        window.plugin.crossLinks.crossLayersLayer.clearLayers();
      }
    });

    // ensure 'disabled' flag is initialised
    if (!map.hasLayer(window.plugin.crossLinks.linkLayer)) {
        window.plugin.crossLinks.disabled = true;
    }

    if (!map.hasLayer(window.plugin.crossLinks.crossLayersLayer)) {
        window.plugin.crossLinks.crossLayersDisabled = true;
    }
}

// Options
window.plugin.crossLinks.manualOpt = function() {
  var html = '<div class="crosslinksMatchColor">'
           + '<input type="color" name="matchColor" id="crosslinks_matchcolor"></input>'
           + '</div>'
           + '</div>';
  dialog({
    html: html,
    dialogClass: 'ui-dialog-crosslinksSet',
    title: 'Cross Links Options'
  });

  $('#crosslinks_matchcolor').spectrum({
    flat: false,
    showInput: false,
    showButtons: false,
    showPalette: true,
    showSelectionPalette: false,
    palette: [ ['#a24ac3','#514ac3','#4aa8c3','#51c34a'],
               ['#c1c34a','#c38a4a','#c34a4a','#c34a6f'],
               ['#000000','#666666','#bbbbbb','#ffffff']
    ],
    change: function(color) { window.plugin.crossLinks.setMatchColor(color.toHexString()); },
    color: window.plugin.crossLinks.currentMatchColor,
  });
}

window.plugin.crossLinks.setMatchColor = function(color) {
  window.plugin.crossLinks.currentMatchColor = color;
  window.plugin.crossLinks.checkAllLinks();
}

window.plugin.crossLinks.updateCount = function () {
    var count = Object.keys(plugin.crossLinks.linkLayerGuids).length;
    $(plugin.crossLinks.pcBox).text(count + ' links blocking.').css({"cursor":(count>0?'pointer':'default')});
}
    
var setup = function() {
    if (window.plugin.drawTools === undefined) {
       alert("'Cross-Links' requires 'draw-tools'");
       return;
    }

    // this plugin also needs to create the draw-tools hook, in case it is initialised before draw-tools
    window.pluginCreateHook('pluginDrawTools');

    // Add options menu
    $('#toolbox').append('<a onclick="window.plugin.crossLinks.manualOpt(); return false;">Cross Links Opt</a>');

    window.plugin.crossLinks.createLayer();

    // events
    window.addHook('pluginDrawTools',function(e) {
        if (e.event == 'layerCreated') {
            // we can just test the new layer in this case
            window.plugin.crossLinks.testAllLinksAgainstLayer(e.layer);
            window.plugin.crossLinks.testCrossLayers(e.layer);
        } else {
            // all other event types - assume anything could have been modified and re-check all links
            window.plugin.crossLinks.checkAllLinks();
            window.plugin.crossLinks.testCrossLayers();
        }
    });

    window.addHook('linkAdded', window.plugin.crossLinks.onLinkAdded);
    window.addHook('mapDataRefreshEnd', window.plugin.crossLinks.onMapDataRefreshEnd);

    $('#toolbox').after('<div id="cross-links-count">0 blocking links</div>');
    $('#cross-links-count').css({"color":"#FFCE00","padding":"4px 2px"});
    window.plugin.crossLinks.pcBox = document.getElementById('cross-links-count');
    var linkCycle = 0;
    window.plugin.crossLinks.pcBox.addEventListener('click', function () {
        if (Object.keys(plugin.crossLinks.linkLayerGuids).length > 0) {
            linkCycle = (linkCycle > Object.keys(plugin.crossLinks.linkLayerGuids).length-1 ? 0 : linkCycle); 
            var link = plugin.crossLinks.linkLayerGuids[Object.keys(plugin.crossLinks.linkLayerGuids)[linkCycle]];
            var linkBounds = L.latLngBounds(link._latlngs[0],link._latlngs[1]);
            var linkMidPt = new L.latLng((link._latlngs[0].lat + link._latlngs[1].lat)/2,(link._latlngs[0].lng + link._latlngs[1].lng)/2);
            debugger;
            map.fitBounds(linkBounds);
            linkCycle++;
        }
    });
}

// PLUGIN END //////////////////////////////////////////////////////////

@@PLUGINEND@@
