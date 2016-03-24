
mapboxgl.accessToken = 'pk.eyJ1IjoibWlsd2F1a2Vlam91cm5hbHNlbnRpbmVsIiwiYSI6IkhmS0lZZncifQ.WemgYJ9P3TcgtGIcMoP2PQ';
var map = new mapboxgl.Map({
    container: 'devtrac--mapbox',
    style: 'mapbox://styles/milwaukeejournalsentinel/cilwqkvux004d9mm3ykk9br7n',
    scrollZoom: false,
    boxoom: false,
    dragRotate: false,
    center: [-87.9800,43.0500],
    zoom: 10,
    maxBounds: [[-89.393005,42.495264],[-87.723083,43.754109]],
});
map.addControl(new mapboxgl.Navigation({position: 'top-right'}));

/*
map.on('click', function (e) {
    map.featuresAt(e.point, {
        radius: 8,
        includeGeometry: true,
        layer: 'markers'
    }, function (err, features) {

        if (err || !features.length) {
            toggleInfoBox();
            return;
        }

        var feature = features[0];

        toggleInfoBox(feature.properties);

    });
});
*/
map.on('style.load', function () {

    $.ajax({
        url: 'http://brick1.dhb.io/api/developments/?spaceless=true',
        jsonpCallback: 'preData',
        dataType: 'jsonp',
        crossDomain: true,
        success: function(data) {
            populateFilters(data.meta);
            populateMap(data.locations);
        }
    });

});

map.on('mousemove', function (e) {
    map.featuresAt(e.point, {
        radius: 8,
        layer: 'markers'
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
        var developersTpl = _.template($('#template--developers').html());
        var dhtml = developersTpl({'developers': meta.developers});
        $('.holder--developers').append(dhtml);
    }
    if (meta.neighborhoods.length > 0) {
        var neighborhoodsTpl = _.template($('#template--neighborhoods').html());
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
        "approved": "#466C95",
        "under-construction": "#F6C90E",
        "construction-complete": "#5DAE8B",
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

function toggleFullScreen() {
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

function toggleInfoBox(data) {
    if (data) {

        var infoboxTpl = _.template($('#template--infobox').html());
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

function toggleFilterBox() {
    $('.devtrac--filterbox').toggleClass('filterbox--hidden');
}
