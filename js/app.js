require("../css/styles.scss");

window.$ = require("jquery");
var _tpl = require("lodash/template");
var _filter = require("lodash/filter");
window._forEach = require('lodash/foreach');

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

    $.ajax({
        url: 'http://brick1.dhb.io/api/developments/?spaceless=true',
        jsonpCallback: 'preData',
        dataType: 'jsonp',
        crossDomain: true,
        success: function(data) {
            populateFilters(data.meta);
            populateMap(data.locations);
            window.devtracPoints = data.locations
        }
    });

});

map.on('click', function (e) {

    map.featuresAt(e.point, {
        radius: 8,
        includeGeometry: true,
        layer: ['approved','proposed','under-construction','construction-completed']
    }, function (err, features) {

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
    }, function (err, features) {
        map.getCanvas().style.cursor = (!err && features.length) ? 'pointer' : '';
    });
});


$(document).ready(function() {
    if ($(window).width() < 621) {
        $('.devtrac--filterbox').addClass('filterbox--hidden');
    }

});

function populateFilters(meta) {
    if (meta.developers.length > 0) {
        var developersTpl = _tpl($('#template--developers').html());
        var dhtml = developersTpl({'developers': meta.developers});
        $('.holder--developers').append(dhtml);
    }
    if (meta.neighborhoods.length > 0) {
        var neighborhoodsTpl = _tpl($('#template--neighborhoods').html());
        var nhtml = neighborhoodsTpl({'neighborhoods': meta.neighborhoods});
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
                    "circle-radius": 8,
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

        $('.fa-times-circle').on('click',function() {
           toggleInfoBox();
        });

    } else {

        $('.devtrac--infobox .infobox--inner').html('');
        $('.devtrac--infobox').addClass('infobox--hidden');

        $('.fa-times-circle').unbind('click');

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
        if (filters.search !== "" && props.name.toLowerCase().trim().indexOf(filters.search.toLowerCase().trim()) < 0) {
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

    clearMap();
    populateMap({"type": "FeatureCollection", "features": filteredPoints});
}
