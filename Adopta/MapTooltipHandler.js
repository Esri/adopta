define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/Evented',
  'dojo/dom-style',
  'dojo/dom-construct',
  'dojo/on',
  "dojo/_base/event"
], function (
  declare,
  lang,
  Evented,
  domStyle,
  domConstruct,
  on,
  event
) {
  return declare([Evented], {
    baseClass: 'jimu-widget-Adopta-MapTooltipHandler',
    map: null, //map object
    handleClickFor: null, //object to hold layer/map object for which click events need to be handled
    _mapTooltip: null, // MapTooltip Container
    _mapMoveHandler: null, // Map move handler
    _mapClickHandler: null, // Map click handler

    constructor: function (options) {
      lang.mixin(this, options);
    },

    startup: function () {
      this._createTooltip();
    },

    /**
    * This function will connect the events
    * @memberOf widgets/Adopta/MapTooltipHandler
    **/
    connectEventHandler: function () {
      this._disableWebMapPopup();
      this._mapClickHandler = on(this.handleClickFor, "click", lang.hitch(this, function (evt) {
        //stop the event propagation
        //if user clicks on a feature map click event should not be fired for adding new asset
        event.stop(evt);
        this._clicked(evt);
      }));
      //handle mouse move on map to show tooltip only on non-touch devices
      if ("ontouchstart" in document.documentElement) {
        domStyle.set(this._mapTooltip, "display", "none");
      } else {
        this._mapMoveHandler = this.map.on("mouse-move", lang.hitch(
          this, this._onMapMouseMove));
        this.map.on("mouse-out", lang.hitch(this, function () {
          domStyle.set(this._mapTooltip, "display", "none");
        }));
      }
    },

    /**
    * This function will disconnects the events
    * @memberOf widgets/Adopta/MapTooltipHandler
    **/
    disconnectEventHandler: function () {
      this._enableWebMapPopup();
      if (this._mapClickHandler) {
        this._mapClickHandler.remove();
      }
      if (this._mapMoveHandler) {
        this._mapMoveHandler.remove();
        this._mapTooltip.style.display = "none";
      }
    },

    /**
    * This function will create map tooltip.
    * @memberOf widgets/Adopta/MapTooltipHandler
    **/
    _createTooltip: function () {
      //create tool-tip to be shown on map move
      this._mapTooltip = domConstruct.create("div", {
        "class": "tooltip",
        "innerHTML": this.nls.selectAssetToolTipBeforeLogin
      }, this.map.container);
      domStyle.set(this._mapTooltip, "position", "fixed");
      domStyle.set(this._mapTooltip, "display", "none");
    },

    /**
    * This function will enable the web map popup.
    * @memberOf widgets/Adopta/MapTooltipHandler
    **/
    _enableWebMapPopup: function () {
      if (this.map) {
        this.map.infoWindow.hide();
        this.map.setInfoWindowOnClick(true);
      }
    },

    /**
    * This function will disable the web map popup.
    * @memberOf widgets/Adopta/MapTooltipHandler
    **/
    _disableWebMapPopup: function () {
      if (this.map) {
        this.map.infoWindow.hide();
        this.map.setInfoWindowOnClick(false);
      }
    },

    /**
    * On map mouse move update the toolTip position
    * to show in infowindow at the selected location.
    * @memberOf widgets/Adopta/MapTooltipHandler
    **/
    _onMapMouseMove: function (evt) {
      // update the tooltip as the mouse moves over the map
      var px, py;
      if (evt.clientX || evt.pageY) {
        px = evt.clientX;
        py = evt.clientY;
      } else {
        px = evt.clientX + document.body.scrollLeft -
          document.body.clientLeft;
        py = evt.clientY + document.body.scrollTop - document
          .body.clientTop;
      }
      domStyle.set(this._mapTooltip, "display", "none");
      domStyle.set(this._mapTooltip, {
        left: (px + 15) + "px",
        top: (py) + "px"
      });
      domStyle.set(this._mapTooltip, "display", "");
    },

    /* ----------------------- */
    /* Event handler functions */
    /* ----------------------- */
    _clicked: function (evt) {
      this.emit("clicked", evt);
    },

    updateTooltip: function () {
      this._mapTooltip.innerHTML = this.nls.selectAssetToolTipAfterLogin;
    }

  });
});