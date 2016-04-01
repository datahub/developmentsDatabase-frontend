require("../css/styles.scss");

window.$ = require("jquery");
var _tpl = require("lodash/template");
var _filter = require("lodash/filter");
var _find = require("lodash/find");
var _map = require("lodash/map");
var _property = require("lodash/property");
var _throttle = require("lodash/throttle");
window._forEach = require('lodash/foreach');

$(document).ready(function() {
    if ($(window).width() < 621) {
        $('.devtrac--filterbox').addClass('filterbox--hidden');
    }
});

window.devtracLayers = [];
window.devtracPoints = {};
window.map;
window.firstRun = true;

mapboxgl.accessToken = 'pk.eyJ1IjoibWlsd2F1a2Vlam91cm5hbHNlbnRpbmVsIiwiYSI6IkhmS0lZZncifQ.WemgYJ9P3TcgtGIcMoP2PQ';
window.map = new mapboxgl.Map({
    container: 'devtrac--mapbox',
    style: 'mapbox://styles/milwaukeejournalsentinel/cilwqkvux004d9mm3ykk9br7n',
    scrollZoom: false,
    boxoom: false,
    dragRotate: false,
    center: [-87.9800,43.0500],
    zoom: 10,
    maxBounds: [[-89.593005,42.195264],[-87.223083,43.954109]],
});
map.addControl(new mapboxgl.Navigation({position: 'top-right'}));

map.on('style.load', function () {

    getCacheData();

});

map.on('click', function (e) {

    map.featuresAt(e.point, {
        radius: 7,
        includeGeometry: true,
        layer: window.devtracLayers
    },
    function (err, features) {

        if (err || !features.length) {
            toggleInfoBox();
            return;
        }
        toggleInfoBox(features[0]);

    });

});

map.on('mousemove', function (e) {
    map.featuresAt(e.point, {
        radius: 8,
        layer: window.devtracLayers
    },
    function (err, features) {
        map.getCanvas().style.cursor = (!err && features.length) ? 'pointer' : '';
    });
});

var getCacheData = function() {
    if (window.localStorage) {

        if (window.localStorage.getItem('devtrac-cache')) {

            var cacheBust = (window.location.hash.indexOf('fresh') > -1) ? true : false;

            var data = JSON.parse(window.localStorage.getItem('devtrac-cache'));
            var cacheLength = (3600 * 1); // 1 hour in seconds
            var now = Math.floor(Date.now() / 1000);

            if ((now - data.timestamp) < cacheLength && !cacheBust) {

                console.log('using cached data');

                window.devtracPoints = data.locations;
                populateFilters(data.meta.developers, data.meta.neighborhoods);
                populateMap(data.locations);

            } else {

                console.log('using fresh data');

                $.ajax({
                    url: 'http://brick1.dhb.io/api/developments/?spaceless=true',
                    jsonpCallback: 'preData',
                    dataType: 'jsonp',
                    crossDomain: true,
                    success: function(data) {
                        window.devtracPoints = data.locations;
                        populateFilters(data.meta.developers, data.meta.neighborhoods);
                        populateMap(data.locations);
                        var storageString = JSON.stringify({
                            timestamp : Math.floor(Date.now() / 1000),
                            locations : data.locations,
                            meta : data.meta,
                        });
                        window.localStorage.setItem('devtrac-cache',storageString);
                    }
                });

            }

        } else {

            $.ajax({
                url: 'http://brick1.dhb.io/api/developments/?spaceless=true',
                jsonpCallback: 'preData',
                dataType: 'jsonp',
                crossDomain: true,
                success: function(data) {
                    window.devtracPoints = data.locations;
                    populateFilters(data.meta.developers, data.meta.neighborhoods);
                    populateMap(data.locations);
                    var storageString = JSON.stringify({
                        timestamp : Math.floor(Date.now() / 1000),
                        locations : data.locations,
                        meta : data.meta,
                    });
                    window.localStorage.setItem('devtrac-cache',storageString);
                }
            });

        }

    } else {
        $.ajax({
            url: 'http://brick1.dhb.io/api/developments/?spaceless=true',
            jsonpCallback: 'preData',
            dataType: 'jsonp',
            crossDomain: true,
            success: function(data) {
                populateFilters(data.meta.developers, data.meta.neighborhoods);
                populateMap(data.locations);
                window.devtracPoints = data.locations;
            }
        });
    }
}

var highlightPt = function(geo) {
    if (geo) {

        if (map.getLayer('highlight')) {
            map.removeLayer('highlight');
            map.removeSource('single-point');
        }

        map.addSource('single-point', {
            "type": "geojson",
            "data": {
                "type": "FeatureCollection",
                "features": [{
                    "geometry": geo,
                    "type": "Feature",
                    "properties": {}
                }]
            }
        });

        map.addLayer({
            "id": "highlight",
            "source": "single-point",
            "type": "circle",
            "paint": {
                "circle-radius": 11,
                "circle-color": "#666666",
                "circle-opacity": .65
            }
        }, window.devtracLayers[0]);

    } else if (map.getLayer('highlight')) {
        map.removeLayer('highlight');
        map.removeSource('single-point');
    }
}

var populateFilters = function(devs, hoods) {
    if (devs.length > 0) {
        var developersTpl = _tpl($('#template--developers').html());
        var dhtml = developersTpl({'developers': devs});
        $('.holder--developers').append(dhtml);
    }
    if (hoods.length > 0) {
        var neighborhoodsTpl = _tpl($('#template--neighborhoods').html());
        var nhtml = neighborhoodsTpl({'neighborhoods': hoods});
        $('.holder--neighborhoods').append(nhtml);
    }
}

var populateMap = function(markers) {

    map.addSource("markers", {
        "type": "geojson",
        "data": markers
    });

    var layerColors = {
        "proposed": "#FF7676",
        "approved": "#F6C90E",
        "under-construction": "#466C95",
        "construction-completed": "#5DAE8B",
    }

    markers.features.forEach(function(feature) {
        var status = feature.properties['status'];

        if (!map.getLayer(status)) {
            map.addLayer({
                "id": status,
                "interactive": true,
                "source": "markers",
                "type": "circle",
                "paint": {
                    "circle-radius": 7,
                    "circle-color": layerColors[status],
                    "circle-opacity": 1
                },
                "filter": ["==", "status", status]
            });
            window.devtracLayers.push(status);
        }
    });

    if (window.firstRun) {
        window.firstRun = false;
        router('go');
    }
}

var clearMap = function() {
    map.removeSource("markers");
    if (map.getLayer('approved')) { map.removeLayer('approved'); }
    if (map.getLayer('proposed')) { map.removeLayer('proposed'); }
    if (map.getLayer('under-construction')) { map.removeLayer('under-construction'); }
    if (map.getLayer('construction-completed')) { map.removeLayer('construction-completed'); }
    window.devtracLayers = [];
}

var toggleFullScreen = function() {

    if ($('.container').hasClass('container--fullscreen')) {

        if ($(window).width() < 621) {
            $('.devtrac--touch').show();
        } else {
            $(document).unbind('keyup.fullscreen');
        }

        map.scrollZoom.disable();

    } else {

        if ($(window).width() < 621) {
            $('.devtrac--touch').hide();
        } else {
            $(document).on('keyup.fullscreen',function(evt) {
                if (evt.keyCode == 27) {
                   toggleFullScreen();
                }
            });
        }

        map.scrollZoom.enable();

    }
    $('.container').toggleClass('container--fullscreen');
    map.resize();

}
$('.toggleFullScreen').on('click',function(){toggleFullScreen()});

var toggleInfoBox = function(data) {
    if (data) {

        highlightPt(data.geometry);

        var infoboxTpl = _tpl($('#template--infobox').html());
        var html = infoboxTpl(data.properties);

        $('.devtrac--infobox .infobox--inner').html(html);
        $('.devtrac--infobox').removeClass('infobox--hidden');

        $('.infobox--close').on('click',function() {
           toggleInfoBox();
        });

        if ($(window).width() > 620) {
            $('.lightbox--open').on('click',function() {
               lighbox($('.imagewrap--image').attr('src'));
            });
        }

        router('set','/development/' + data.properties.id);

    } else {

        highlightPt();

        $('.devtrac--infobox').addClass('infobox--hidden');

        $('.infobox--close').unbind('click');
        if ($(window).width() > 620) {
            $('.lighbox--open').unbind('click');
        }

        router('set','');

    }
}

var lighbox = function(imageUrl) {

    if (imageUrl) {
        var theImage = new Image();
        theImage.src = imageUrl;
        theImage.addEventListener('load', function() {

            $('.devtrac--lighbox').show();

            var winHeight = $('#devtrac').height();
            var winWidth = $('#devtrac').width();
            var imgHeight = this.height;
            var imgWidth = this.width;
            var newHeight = 0, scaledHeight = 0;
            var newWidth = 0, scaledWidth = 0;

            if (imgHeight > winHeight) {
                newHeight = Math.round(winHeight * .92);
                newWidth = Math.round((newHeight * imgWidth) / imgHeight);
            }
            if (newWidth > winWidth) {
                scaledWidth = Math.round(winWidth * .92);
                scaledHeight = Math.round((scaledWidth * newHeight) / newWidth);
            } else if (imgWidth > winWidth) {
                scaledWidth = Math.round(winWidth * .92);
                scaledHeight = Math.round((scaledWidth * imgHeight) / imgWidth);
            } else {
                scaledWidth = newWidth;
                scaledHeight = newHeight;
            }

            if (imgHeight > imgWidth) {
                var className = 'portrait';
                var style = "height: " + scaledHeight + "px;";
            } else {
                var className = 'landscape';
                var style = "width: " + scaledWidth + "px;";
                if (scaledHeight < winHeight) {
                    var diff = (winHeight - scaledHeight) / 2;
                    style = style + "margin-top:" + diff + "px;";
                }
            }

            $('.devtrac--lighbox').append('<img class="lightbox--img ' + className + '" style="' + style + '" src="' + imageUrl + '">');

            $('.lighbox--close').on('click',function() {
               lighbox();
            });

        });

    } else {

        $('.devtrac--lighbox').hide();
        $('.lightbox--close').unbind('click');
        $('.lightbox--img').remove();

    }
}

var toggleFilterBox = function() {
    $('.devtrac--filterbox').toggleClass('filterbox--hidden');
}
$('.toggleFilterBox').on('click',function(){toggleFilterBox()});

var setFilters = function(filterOptions) {
    if (filterOptions.search !== "") {
        $('#devtrac--form input[name=search]').val(filterOptions.search);
    }
    if (filterOptions.developer !== "") {
        $('#devtrac--form select[name=developer] option[value="'+filterOptions.developer+'"]').prop("selected", true);
    }
    if (filterOptions.neighborhood !== "") {
        $('#devtrac--form select[name=neighborhood] option[value="'+filterOptions.neighborhood+'"]').prop("selected", true);
    }
}

var getFilters = function() {
    filters = {};
    hash = "";
    $.each($('#devtrac--form').serializeArray(),function() {
        name = $(this).attr('name');
        value = $(this).attr('value');
        filters[name] = value;
        if ((name === 'search' || name === 'developer' || name === 'neighborhood') && value !== '') {
            hash += "&" + name + "=" + value;
        }
    });
    filterPoints(filters);
    router('set','/search/' + hash);
}
$('#devtrac--form input[type=text]').on('keyup',_throttle(getFilters, 500, {'leading': false}));
$('#devtrac--form input[type=checkbox], #devtrac--form select').on('change',getFilters);

var filterPoints = function(filters) {
    filteredPts = _filter(devtracPoints.features, function(point) {
        var props = point.properties;

        var search = true, neighborhood = true, developer = true;

        // search
        if (filters.search !== "" && props.name.toLowerCase().trim().indexOf(filters.search.toLowerCase().trim()) < 0 ) {
            var search = false;
        }

        // neightborhood
        if (filters.neighborhood !== "" && props.neighborhood.trim() !== filters.neighborhood.trim()) {
            var neighborhood = false;
        }

        // developer
        if (filters.developer !== "" && props.developer.toLowerCase().trim().indexOf(filters.developer.toLowerCase().trim()) < 0) {
            var developer = false;
        }

        // status
        var approved = false, proposed = false, underConstruction = false, constructionCompleted = false;
        if (filters.approved === "on" && props.status === "approved") {
            var approved = true;
        }
        if (filters.proposed === "on" && props.status === "proposed") {
            var proposed = true;
        }
        if (filters.underConstruction === "on" && props.status === "under-construction") {
            var underConstruction = true;
        }
        if (filters.constructionCompleted === "on" && props.status === "construction-completed") {
            var constructionCompleted = true;
        }
        var status = (approved || proposed || underConstruction || constructionCompleted);

        // usage
        var commercial = false, residential = false, manufacturing = false, mixed = false;
        if (filters.commercial === "on" && props.usage === "commercial") {
            var commercial = true;
        }
        if (filters.residential === "on" && props.usage === "residential") {
            var residential = true;
        }
        if (filters.manufacturing === "on" && props.usage === "manufacturing") {
            var manufacturing = true;
        }
        if (filters.mixed === "on" && props.usage === "mixed-use-commercial-residential") {
            var mixed = true;
        }
        var usage = (commercial || residential || manufacturing || mixed);

        return (search && neighborhood && developer && status && usage);

    });

    //if (filters.search !== "" && filteredPts.length > 0) {
        //var list = _map(filteredPts, _property('properties.name'));
    //}
    //TODO: refactor to use mapbox layer filters instead of entire map redraw
    clearMap();
    populateMap({"type": "FeatureCollection", "features": filteredPts});

}

var router = function(action,route) {
    if (action === 'set') {
        window.location.hash = route.trim();
    } else if (action === 'go') {
        var hash = window.location.hash.substr(1);
        if (hash) {
            var paths = hash.split("/").filter(Boolean);
            if (paths[0] === 'development' && paths[1]) {
                development = _find(window.devtracPoints.features, function(o){ return o.properties.id == paths[1] ? true : false;});
                if (development) {
                    setTimeout(function() {
                        map.flyTo({center: development.geometry.coordinates, zoom:16});
                        toggleInfoBox(development);
                    }, 500);
                }
            } else if (paths[0] === 'search' && paths[1]) {
                var hashFilters = paths[1].split("&").filter(Boolean);
                var filterOptions = ['search','developer','neighborhood'];
                var filters = {
                    'search':'',
                    'developer': '',
                    'neighborhood': '',
                    'commercial': 'on',
                    'residential': 'on',
                    'manufacturing': 'on',
                    'mixed': 'on',
                    'approved': 'on',
                    'proposed': 'on',
                    'underConstruction': 'on',
                    'constructionCompleted': 'on'
                };
                _forEach(hashFilters, function(filter) {
                    var filterParts = filter.split("=");
                    if ($.inArray(filterParts[0],filterOptions) > -1) {
                        filters[filterParts[0]] = filterParts[1];
                    }
                });
                filterPoints(filters);
                setFilters(filters);
            }
        }
    }
}
