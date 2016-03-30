require("../css/styles.scss");

window.$ = require("jquery");
var _tpl = require("lodash/template");
var _filter = require("lodash/filter");
var _map = require("lodash/map");
var _uniq = require("lodash/uniq");
var _property = require("lodash/property");
window._forEach = require('lodash/foreach');

$(document).ready(function() {
    if ($(window).width() < 621) {
        $('.devtrac--filterbox').addClass('filterbox--hidden');
    }
});

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

    if (window.localStorage) {

        if (window.localStorage.getItem('devtrac-cache')) {

            var cacheBust = (window.location.hash.indexOf('fresh') > -1) ? true : false;

            var data = JSON.parse(window.localStorage.getItem('devtrac-cache'));
            var cacheLength = (3600 * 1); // 1 hour in seconds
            var now = Math.floor(Date.now() / 1000);

            if ((now - data.timestamp) < cacheLength && !cacheBust) {

                console.log('using cached data');

                var developers = _uniq(_map(data.locations.features, _property('properties.developer')));
                var neighborhoods = _uniq(_map(data.locations.features, _property('properties.neighborhood')));
                populateFilters(developers, neighborhoods);
                populateMap(data.locations);
                window.devtracPoints = data.locations;

            } else {

                console.log('using fresh data');

                $.ajax({
                    url: 'http://brick1.dhb.io/api/developments/?spaceless=true',
                    jsonpCallback: 'preData',
                    dataType: 'jsonp',
                    crossDomain: true,
                    success: function(data) {
                        var developers = _uniq(_map(data.locations.features, _property('properties.developer')));
                        var neighborhoods = _uniq(_map(data.locations.features, _property('properties.neighborhood')));
                        populateFilters(developers, neighborhoods);
                        populateMap(data.locations);
                        window.devtracPoints = data.locations;
                        var storageString = JSON.stringify({
                            timestamp : Math.floor(Date.now() / 1000),
                            locations : data.locations
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
                    var developers = _uniq(_map(data.locations.features, _property('properties.developer')));
                    var neighborhoods = _uniq(_map(data.locations.features, _property('properties.neighborhood')));
                    populateFilters(developers, neighborhoods);
                    populateMap(data.locations);
                    window.devtracPoints = data.locations;
                    var storageString = JSON.stringify({
                        timestamp : Math.floor(Date.now() / 1000),
                        locations : data.locations
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
                var developers = _uniq(_map(data.locations.features, _property('properties.developer')));
                var neighborhoods = _uniq(_map(data.locations.features, _property('properties.neighborhood')));
                populateFilters(developers, neighborhoods);
                populateMap(data.locations);
                window.devtracPoints = data.locations;
            }
        });
    }

});

map.on('click', function (e) {

    map.featuresAt(e.point, {
        radius: 7,
        includeGeometry: true,
        layer: ['approved','proposed','under-construction','construction-completed']
    },
    function (err, features) {

        if (err || !features.length) {
            toggleInfoBox();
            return;
        }
        var feature = features[0];
        toggleInfoBox(feature.properties);

    });

});

map.on('mousemove', function (e) {
    map.featuresAt(e.point, {
        radius: 8,
        layer: ['approved','proposed','under-construction','construction-completed']
    },
    function (err, features) {
        map.getCanvas().style.cursor = (!err && features.length) ? 'pointer' : '';
    });
});

function populateFilters(devs, hoods) {
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

function populateMap(markers) {

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
        }
    });

}

function clearMap() {
    map.removeSource("markers");
    if (map.getLayer('approved')) { map.removeLayer('approved'); }
    if (map.getLayer('proposed')) { map.removeLayer('proposed'); }
    if (map.getLayer('under-construction')) { map.removeLayer('under-construction'); }
    if (map.getLayer('construction-completed')) { map.removeLayer('construction-completed'); }
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

        var infoboxTpl = _tpl($('#template--infobox').html());
        var html = infoboxTpl(data);

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

    } else {

        $('.devtrac--infobox .infobox--inner').html('');
        $('.devtrac--infobox').addClass('infobox--hidden');

        $('.infobox--close').unbind('click');
        if ($(window).width() > 620) {
            $('.lighbox--open').unbind('click');
        }
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
            var scaledHeight = this.height;
            var scaledWidth = this.width;

            if (imgHeight > winHeight) {
                scaledHeight = Math.round(winHeight * .92);
                scaledWidth = Math.round((scaledHeight * imgWidth) / imgHeight);
            } else if (imgWidth > winWidth) {
                scaledWidth = Math.round(winWidth * .92);
                scaledHeight = Math.round((scaledWidth * imgHeight) / imgWidth);
            }

            if (imgHeight > imgWidth) {
                var className = 'portrait';
                var style = "height: " + scaledHeight + "px";
            } else {
                var className = 'landscape';
                var style = "width: " + scaledWidth + "px";
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

var getFilters = function() {
    filters = {}
    $.each($('#devtrac--form').serializeArray(),function() {
        name = $(this).attr('name');
        value = $(this).attr('value');
        filters[name] = value;
    });
    filterPoints(filters);
}
$('#devtrac--form input[type=text]').on('keyup',getFilters);
$('#devtrac--form input[type=checkbox], #devtrac--form select').on('change',getFilters);

var filterPoints = function(filters) {
    filteredPoints = _filter(devtracPoints.features, function(point) {
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

    if (filters.search !== "" && filteredPoints.length > 0) {
        var list = _map(filteredPoints, _property('properties.name'));
    }

    clearMap();
    populateMap({"type": "FeatureCollection", "features": filteredPoints});
}
