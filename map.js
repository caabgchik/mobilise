(function($) {
  $(document).ready(function(){
    var HoverHandler = function(info) {
        var _info = info;
        var _inflight = false;
        var _xhr = null;
        
        this.overstation = function(e)
        {
            _inflight = true;
            _xhr = $.getJSON( "https://api.tfl.gov.uk/StopPoint/"+e.target.options.options.id+"/Arrivals?mode=tube", function( data ) {
                _inflight = false;
                _xhr = null;

                function sortbylineandarrival(a, b)
                {
                    var aline = a.lineId;
                    var bline = b.lineId;

                    var aplatform = a.platformName;
                    var bplatform = b.platformName;

                    var atime = a.timeToStation;
                    var btime = b.timeToStation;

                    if (aline < bline) return -1;
                    if (aline > bline) return 1;
                    if (aplatform < bplatform) return -1;
                    if (aplatform > bplatform) return 1;
                    if (atime < btime) return -1;
                    if (atime > btime) return 1;
                    return 0;
                }
                
                data.sort(sortbylineandarrival);
                _info.update(e.target.options.options.name, data);
            });
            e.target.openPopup();
        }
        
        this.outstation = function(e)
        {
            if (_inflight)
            {
                _xhr.abort();
            }
            e.target.closePopup();
            _info.update();
            _xhr = null;
            _inflight = false;
        }
    }
    
    var InfoCardView = function(map, linecolors, linenames) {
        var _map = map;
        var _info = L.control();
        var _div = null;
        var _linecolors = linecolors;
        var _linenames = linenames;

        var _update = function(station, arrivals)
        {
            _div.innerHTML = '<h4>London Underground</h4>';
            if (arrivals)
            {
                _div.innerHTML += '<b>Arrivals at '+station+':</b>';
                var lineid = "";
                var platformName = "";
                var count = 0;                
                $.each(arrivals, function(k, v) { 
                    {
                        if (v.lineId != lineid)
                        {
                            lineid = v.lineId;
                            count = 0;
                            _div.innerHTML += '<div style="margin-top:7px; margin-bottom:7px; padding:5px; display:block; color:white; background-color:'+_linecolors[lineid]+'">'+_linenames[lineid]+'</div>'
                        }
                        if (v.platformName != platformName)
                        {
                            platformName = v.platformName;
                            count = 0;
                            _div.innerHTML += '<div style="margin-top:7px; margin-bottom:7px; display:block;">'+v.platformName+'</div>'                            
                        }                        
                        if (count < 3)
                        {
                            _div.innerHTML += v.towards + ' - ' + timeconv(v.timeToStation) + '<br/>';
                            count += 1;
                        }
                    }
                });
            }
            else
            {
                _div.innerHTML += '<b>Hover over a station</b>';
            }
        }
        
        this.update = function(station, arrivals)
        {
            _update(station, arrivals);
        }
        
        _info.onAdd = function (map) {
            _div = L.DomUtil.create('div', 'info');
            _update();
            return _div;
        };
        
        _info.addTo(_map);
    }

    var StopPointFactory = function(map, hovercard) {
        var _stopPoints = {}
        var _map = map;
        var _hovercard = hovercard;
        var _icon = L.icon({iconUrl: 'icon1_underground.png', iconSize: [36, 36], iconAnchor: [18, 18]});

        this.build = function(stopPointId, name, lat, lon)
        {
            if (!(stopPointId in _stopPoints))
            {
                var ll = [lat, lon];
                var marker = L.marker(ll, {
                    title: name,
                    options: {"id":stopPointId, "name":name}
                  }).addTo(_map);
                marker.bindPopup(name);
                marker.on('mouseover',_hovercard.overstation); 
                marker.on('mouseout',_hovercard.outstation);
                _stopPoints[stopPointId] = marker;
            }
            return _stopPoints[stopPointId];
        }
    }

    var LineFactory = function(id, stoppointfactory, map, linecolors) {
        var _id = id;
        var _linecolors = linecolors;
        var _stopPointFactory = stoppointfactory;
        var _map = map;
        var _stopPoints = {};

        this.fetch = function()
        {
            $.getJSON( "https://api.tfl.gov.uk/line/"+id+"/route/sequence/outbound", function( data ) { 
                $.each(data.stopPointSequences, function(k, v) { 
                    var line = [];
                    $.each(v.stopPoint, function(k, sp) {
                        line.push([sp.lat, sp.lon]);
                        _stopPoints[sp.id] = _stopPointFactory.build(sp.id, sp.name, sp.lat, sp.lon);
                    });
                    var polyline = L.polyline(line, {weight:8, color:_linecolors[_id]}).addTo(_map);
                });
            });
        }
    }
    
    function timeconv(sec) {
        var seconds = sec;
        var minutes = Math.round((sec/(60)));
        if (seconds < 60) {
            return seconds + "s";
        } else {
            return minutes + "m";
        } 
    }
    
    var map = L.eeGeo.map("map", "f7947bc1f34af0f1939d4414aa014118", {
        center: [51.517327, -0.120005],
        zoom: 16
    });
    
    var linecolors = {
                      "bakerloo":"#996633",
                      "central":"#CC3333",
                      "circle":"#FFCC00",
                      "district":"#006633",
                      "hammersmith-city":"#CC9999",
                      "jubilee":"#868F98",
                      "metropolitan":"#660066",
                      "northern":"#000000",
                      "piccadilly":"#0019A8",
                      "victoria":"#0099CC",
                      "waterloo-city":"#66CCCC"
                    };
    var linenames = {
                      "bakerloo":"Bakerloo",
                      "central":"Central",
                      "circle":"Circle",
                      "district":"District",
                      "hammersmith-city":"Hammersmith &amp; City",
                      "jubilee":"Jubilee",
                      "metropolitan":"Metropolitan",
                      "northern":"Northern",
                      "piccadilly":"Piccadilly",
                      "victoria":"Victoria",
                      "waterloo-city":"Waterloo &amp; City"
                    };                    
    var infocard = new InfoCardView(map, linecolors, linenames);
    var hover = new HoverHandler(infocard);
    var stopPointFactory = new StopPointFactory(map, hover);
    var lines = [];

    $.getJSON( "https://api.tfl.gov.uk/line/mode/tube", function(data) {
        $.each(data, function(k, line) {
            var lineFactory = new LineFactory(line.id, stopPointFactory, map, linecolors);
            lineFactory.fetch();
            lines.push(lineFactory);
        });
    });
  });
}(jQuery));
