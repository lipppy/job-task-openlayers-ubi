import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import GeoJSON from 'ol/format/GeoJSON';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM, Vector as VectorSource } from 'ol/source';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { fromLonLat, toLonLat } from 'ol/proj';
import Select from 'ol/interaction/Select';
import Overlay from 'ol/Overlay';
import {toStringHDMS} from 'ol/coordinate';
import $ from "jquery";

var container = document.getElementById('popup');
var content = document.getElementById('popup-content');
var select = null;

/**
 * Create an overlay to anchor the popup to the map.
 */
var overlay = new Overlay({
    element: container,
    autoPan: true,
    autoPanAnimation: {
        duration: 250
    }
});

const centerAustria = [14.10, 47.5];
const centerAustriaWebMercator = fromLonLat(centerAustria);

var basemap = new TileLayer({
    source: new OSM(),
    name: "Basemap"
});

var view = new View({
    center: centerAustriaWebMercator,
    zoom: 7
});

var map = new Map({
    layers: [
        basemap
    ],
    overlays: [
        overlay
    ],
    target: 'map',
    view: view
});

var styleFunctionRegion = function(feature) {
    return new Style({
        stroke: new Stroke({
            color: 'rgba(0, 0, 0, 0.5)',
            width: 4
        }),
        fill: new Fill({
            color: 'rgba(0, 0, 0, 0.25)'
        })
    });
}

var styleFunctionPoints = function (feature) {
    //console.log("sFP", feature);
    var value = feature.get("value");
    /*
    At first I set the colors depend on the given range - Used hsl first parameter dynamically from 0 to 300 to avoid red color repetitions

    var rangeValue = parseFloat(infoRegion.max).toFixed(2) - parseFloat(infoRegion.min).toFixed(2);
    var hslOne = Math.floor(300.0 - (parseFloat(280).toFixed(2) / rangeValue * (value - parseFloat(infoRegion.min))));
    if (rangeValue > 0.0) {
        //var hsl = 'hsl(' + hslOne + ', 50%, 50%)';
    } else {
        // Not valid range
        //var hsl = 'hsl(0, 0%, 0%)';
    }
    */
    var hsl = 'hsl(110, 50%, 50%)';
    if (infoRegion.med > value) {
        hsl = 'hsl(220, 50%, 50%)';
    }
    if (infoRegion.med < value) {
        hsl = 'hsl(0, 50%, 50%)';
    }

    return new Style({
        image: new CircleStyle({
            radius: 6,
            fill: new Fill({
                color: hsl
            }),
            stroke: new Stroke({
                color: '#fff',
                width: 2
            })
        })
    });
};

var selectorRegionSelection = ".region-selection";
var selectorRegionSelected = ".region-selected a";
var isRegionSelectionVisible = false;
var gidRegion;
var nameRegion;
var urlRegion;
var infoRegion;

$(selectorRegionSelected).on("click", function() {
    isRegionSelectionVisible = $(selectorRegionSelection).is(":visible");
    if (isRegionSelectionVisible) {
        $(selectorRegionSelection).hide();
    } else {
        $(selectorRegionSelection).show();
    }
});

$("a.region").on("click", function() {
    // Close Popup - Avoid Open Popup From Different Region or Region Point
    $("#popup-closer").trigger("click");

    // Get Region Params From Data Attributes
    nameRegion = $(this).attr("data-region-name");
    gidRegion = $(this).attr("data-region-gid");

    // Set Endpoint to Get Region Information
    urlRegion = "region/" + gidRegion;

    // Get Region Information & Assign To Map c Set Interactions
    var jqxhr = $.getJSON(urlRegion, function (data) {

        // Region Info
        infoRegion = data.region.info;

        // Set Format
        var format = new GeoJSON({
            featureProjection: "EPSG:3857"
        });

        // Set Region Layer
        var vectorSourceRegion = new VectorSource({
            features: format.readFeatures(data.region.geojson.region)
        });
        var vectorLayerRegion = new VectorLayer({
            source: vectorSourceRegion,
            style: styleFunctionRegion
        });

        // Set Points Layer
        var vectorSourcePoints = new VectorSource({
            features: format.readFeatures(data.region.geojson.points)
        });
        var vectorLayerPoints = new VectorLayer({
            source: vectorSourcePoints,
            style: styleFunctionPoints
        });

        // Erase All Layers Before Load New One - Except Basemap
        map.getLayers().getArray()
            .filter(layer => layer.get('name') !== "Basemap")
            .forEach(layer => map.removeLayer(layer));

        // Add Choosen Layers
        map.getLayers().extend([vectorLayerRegion, vectorLayerPoints]);

        // Map Auto Zoom Fit to Region Layer
        var feature = vectorSourceRegion.getFeatures()[0];
        var polygon = feature.getGeometry();
        view.fit(polygon, {
            padding: [
                20,
                20,
                20,
                20
            ]
        });

        // Set Event When Click on GeoJSON Element - Show Details in Popup
        select = new Select();
        map.removeInteraction(select);
        map.addInteraction(select);
        select.on('select', function(e) {
            var selectedFeature = e.selected[0];
            var coordinate = e.mapBrowserEvent.coordinate
            var hdms = toStringHDMS(toLonLat(coordinate));
            var pointValue = selectedFeature.get("value");
            var popupContent = "";
            if (pointValue === undefined) {
                popupContent = "<p>Region Info</p>";
                popupContent += "<span><b>Region:</b> " + nameRegion + "</span>";
                popupContent += "<span><b>Minimum:</b> " + parseFloat(infoRegion.min).toFixed(2) + "</span>";
                popupContent += "<span><b>Average:</b> " + parseFloat(infoRegion.avg).toFixed(2) + "</span>";
                popupContent += "<span><b>Median:</b> " + parseFloat(infoRegion.med).toFixed(2) + "</span>";
                popupContent += "<span><b>Maximum:</b> " + parseFloat(infoRegion.max).toFixed(2) + "</span>";
            } else {
                popupContent = "<p>Point Info</p>";
                popupContent += "<span><b>Region:</b> " + nameRegion + "</span>";
                popupContent += "<span><b>Position:</b> " + hdms + "</span>";
                popupContent += "<span><b>Value:</b> " + parseFloat(pointValue).toFixed(2) + "</span>";
            }
            content.innerHTML = popupContent;
            overlay.setPosition(coordinate);
        });

        // Show Selected Region Text & Hide Region Selection Menu
        $(selectorRegionSelected).text("Selected Region: " + nameRegion);
        $(selectorRegionSelection).hide();

        $(".region-info-min").text(parseFloat(infoRegion.min).toFixed(2));
        $(".region-info-max").text(parseFloat(infoRegion.max).toFixed(2));
        $(".region-info-avg").text(parseFloat(infoRegion.avg).toFixed(2));
        $(".region-info-med").text(parseFloat(infoRegion.med).toFixed(2));
        $(".region-info-container").show();

        // Show Legend Axis With Counted Values
        var leftAverage = 280.0 * 0.5;
        var percentMedian = (infoRegion.med - infoRegion.min) / (infoRegion.max - infoRegion.min);
        var leftMedian = 280.0 * percentMedian;
        var legendAxisContent = "";
        legendAxisContent += '<div class="legend-axis">';
        legendAxisContent += '<span class="legend-axis-thick min"></span>';
        legendAxisContent += '<span class="legend-mark min rotate">' + parseFloat(infoRegion.min).toFixed(2) + '</span>';
        legendAxisContent += '<span class="legend-axis-thick max"></span>';
        legendAxisContent += '<span class="legend-mark max rotate">' + parseFloat(infoRegion.max).toFixed(2) + '</span>';
        legendAxisContent += '<span class="legend-axis-thick med" style="left: ' + leftAverage + 'px;"></span>';
        legendAxisContent += '<span class="legend-mark med rotate" style="left: ' + leftAverage + 'px;">' + parseFloat(infoRegion.avg).toFixed(2) + '</span>';
        legendAxisContent += '<span class="legend-axis-thick med" style="left: ' + leftMedian + 'px;"></span>';
        legendAxisContent += '<span class="legend-mark med rotate" style="left: ' + leftMedian + 'px;">' + parseFloat(infoRegion.med).toFixed(2) + '</span>';
        legendAxisContent += '</div>';
        $(".legend-axis").remove();
        $(".legend-container").prepend(legendAxisContent);
        $(".legend-container").show();

    }).done(function () {
        //console.log("second success");
    }).fail(function () {
        //console.log("error");
    }).always(function () {
        //console.log("complete");
    });
});

$(document).ready(function() {
    /**
     * Add a click handler to hide the popup.
     * @return {boolean} Don't follow the href.
     */
    var closer = document.getElementById('popup-closer');
    closer.onclick = function() {
        overlay.setPosition(undefined);
        closer.blur();
        return false;
    };
});