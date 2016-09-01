define([
  'dojo/_base/declare',
  'jimu/BaseWidget',
  './MapTooltipHandler',
  './Login',
  './AssetDetails',
  './MyAssets',
  'dojo/_base/lang',
  'dojo/dom-class',
  'dojo/dom-attr',
  'jimu/dijit/Message',
  'jimu/dijit/LoadingIndicator',
  'dojo/on',
  'dojo/string',
  'dojo/dom-construct',
  'esri/layers/GraphicsLayer',
  'esri/geometry/Point',
  'esri/geometry/Polyline',
  'esri/geometry/Polygon',
  'esri/graphic',
  'esri/SpatialReference',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/symbols/SimpleFillSymbol',
  'esri/Color',
  'esri/toolbars/draw',
  'esri/tasks/Geoprocessor',
  'jimu/utils',
  'esri/request',
  'esri/tasks/query',
  'esri/geometry/geometryEngine'
],
function (
  declare,
  BaseWidget,
  MapTooltipHandler,
  Login,
  AssetDetails,
  MyAssets,
  lang,
  domClass,
  domAttr,
  Message,
  LoadingIndicator,
  on,
  string,
  domConstruct,
  GraphicsLayer,
  Point,
  Polyline,
  Polygon,
  Graphic,
  SpatialReference,
  SimpleLineSymbol,
  SimpleMarkerSymbol,
  SimpleFillSymbol,
  Color,
  Draw,
  Geoprocessor,
  jimuUtils,
  esriRequest,
  Query,
  geometryEngine) {
  return declare([BaseWidget], {
    baseClass: 'jimu-widget-Adopta', //Widget base class name
    _isValidConfig: null, //Flag to check whether config has valid data for the widget
    _assetLayer: null, //Holds an object of configured asset layer from webmap
    _prevOpenPanel: null, //Holds the name of previously open panel
    _mapTooltipHandler: null, //Holds an instance of Map tooltip handler
    _assetDetails: null, //Holds an instance of AssetDetails
    _loading: null, //Loading indicator instance
    _featureGraphicsLayer: null, //Graphics layer to add highlight the features
    _showtooltip: true, //Flag to indicate whether to show the map tooltip or not
    _confirmationBox: null, //Holds object of confirmation box,
    _toolBar: null, //Holds draw toolbar object

    postCreate: function () {
      this.inherited(arguments);
    },

    postMixInProperties: function () {
      //mixin default nls with widget nls
      this.nls.common = {};
      this.nls.common = window.jimuNls.common;
    },

    startup: function () {
      this.inherited(arguments);
      // validate if layers are configured then only load the widget
      this._isValidConfig = this._validateConfig();
      domClass.add(this.domNode.parentElement, "esriCTOverridePanelStyle");
      //get url parameters
      this.config.urlParams = this._getUrlParams();
      //add key in config to hold userDetails
      this.config.userDetails = null;
      //hardcoded email field as it is not fetched form user table
      this.config.emailField = "email";
      //Check for valid configuration
      if (this._isValidConfig) {
        //Get theme color
        this._getSelectedThemeColor();
        //if url is having userID then load login screen
        if (this.config.urlParams && !this.config.urlParams.userid) {
          this._prevOpenPanel = "login";
          domClass.remove(this.loginSection, "esriCTHidden");
        }
        //Initialize loading widget
        this._initLoading();
        this._assetLayer = this.map.getLayer(this.config.assetLayerDetails.id);
        //Set Map Tooltip Handler
        this._createMapTooltipHandler();
        //Panel to show asset details
        this._createAssetDetailsPanel();
        //Panel to show my assets
        this._createMyAssetsInstance();
        //create login instance
        this._createLoginInstance();
        this.own(on(this.loginInfoSectionPanel, "click",
          lang.hitch(this, this._myAssestsBtnClicked)));
        //create & add graphics layer to highlight selected feature
        this._featureGraphicsLayer = new GraphicsLayer();
        on(this._featureGraphicsLayer, "click", lang.hitch(this, function (evt) {
          //Dispatch event to feature layer
          if (evt.graphic) {
            evt.graphic = this._assetDetails.selectedFeature;
          }
          this._assetLayer.onClick(evt);
        }));
        this.map.addLayer(this._featureGraphicsLayer);
        //create Geoprocessor instance
        this._gpService = new Geoprocessor(this.config.gpServiceURL);
      }
    },

    /**
    * get URL parameters
    * @memberOf widgets/Adopta/Widget
    **/
    _getUrlParams: function () {
      var urlObject = jimuUtils.urlToObject(document.location.href);
      urlObject.query = urlObject.query || {};
      return urlObject.query;
    },

    /**
    * This function initialize the search widget
    * @memberOf widgets/Adopta/Widget
    */
    _createMapTooltipHandler: function () {
      // create an instance of MapTooltipHandler
      this._mapTooltipHandler = new MapTooltipHandler({
        nls: this.nls,
        map: this.map,
        config: this.config,
        handleClickFor: this._assetLayer
      });
      //handle clicked event
      this._mapTooltipHandler.on("clicked", lang.hitch(this, function (evt) {
        if (this._assetDetails) {
          this._assetDetails.showAssetInfoPopup(evt.graphic);
          this._highlightFeatureOnMap(evt.graphic, false);
        }
      }));
      // once widget is created call its startup method
      this._mapTooltipHandler.startup();
    },

    /**
    * This function initialize the login widget
    * @memberOf widgets/Adopta/Widget
    */
    _createLoginInstance: function () {
      var parameterLabel;
      // create an instance of login
      this._loginInstance = new Login({
        nls: this.nls,
        map: this.map,
        config: this.config,
        loading: this._loading,
        layer: this._assetLayer
      }, domConstruct.create("div", {}, this.loginSection));
      this._loginInstance.on("showMessage", lang.hitch(this, this._showMessage));
      this._loginInstance.on("loggedIn", lang.hitch(this, function (userDetails) {
        this.config.userDetails = lang.clone(userDetails);
        //set the logged in user email as innerHTML to my asset button
        domAttr.set(this.myAssestsBtn, "innerHTML",
          this.config.userDetails[this.config.emailField]);
        //Passing true value will perform actions from URL
        this._myAssetsInstance.getMyAssets(true);
        //navigate to myAsset panel
        this._showPanel("myAsset");
        //once user is logged in the functionality to add assets will be enabled so connect and update the tooltip
        this._mapTooltipHandler.connectEventHandler();
        this._mapTooltipHandler.updateTooltip();
        parameterLabel = this.config.actions.assign.urlParameterLabel;
        //check for url params has adoptId adopt the selected asset
        if (this.config.urlParams && this.config.urlParams.hasOwnProperty(parameterLabel)) {
          this._assetDetails.fetchSelectedAsset(this.config.urlParams[parameterLabel]).then(
            lang.hitch(this, function (response) {
            this._assetDetails.getSelectedAssetDetails(response);
          }));
        }
        //handle map click handler as once user is logged in he can add assets
        this.mapClickHandler = on.pausable(this.map, "click", lang.hitch(this, this._onMapClicked));
      }));
      //Listen for sign in event
      this._loginInstance.on("signedIn", lang.hitch(this, this._onSignedIn));
      //If login process fails, show login panel and connect map events
      this._loginInstance.on("invalidLogin", lang.hitch(this, function () {
        this._showPanel("login");
        this._mapTooltipHandler.connectEventHandler();
      }));
      //If user is successfully authenticated, disconnect map events
      this._loginInstance.on("userAuth", lang.hitch(this, function () {
        this._mapTooltipHandler.disconnectEventHandler();
      }));
      //Listen for registration complete event and attach map handlers
      this._loginInstance.on("registeredUserCallback", lang.hitch(this, function () {
        this._mapTooltipHandler.connectEventHandler();
      }));
      this._loginInstance.startup();
    },

    /**
    * Add new asset on map click if no asset is found in configured buffer distance
    * @params {evt} Map clicked event
    * @memberOf widgets/Adopta/Widget
    */
    _onMapClicked: function (evt) {
      var bufferedGeometries, query, newMsg;
      query = new Query();
      bufferedGeometries = geometryEngine.geodesicBuffer([evt.mapPoint],
        [this.config.toleranceSettings.distance],
        this.config.toleranceSettings.distanceUnits,
        true);
      query.geometry = bufferedGeometries[0];
      //Incase of polygon and line layer, check if the feature intersects with the drawn buffer
      if (this._assetLayer.geometryType !== "esriGeometryPoint") {
        query.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;
      }
      this._assetLayer.queryIds(query, lang.hitch(this, function (features) {
        //on map click create asset only if any other asset does not exist in near by area
        if (!features || (features.hasOwnProperty("length") && features.length === 0)) {
          if (this.config.addAssetConfirmationMsg.indexOf('layerName') !== -1) {
            newMsg = string.substitute(this.config.addAssetConfirmationMsg,
              { layerName: this._assetLayer.name });
          } else {
            newMsg = this.config.addAssetConfirmationMsg;
          }
          this._confirmationBox = new Message({
            message: newMsg,
            type: "question",
            buttons: [{
              "label": this.nls.common.yes, "onClick": lang.hitch(this, function () {
                if (this._assetLayer.geometryType === "esriGeometryPoint") {
                  this._confirmationBox.close();
                  this._addNewFeature(evt.mapPoint);
                } else if (this._assetLayer.geometryType === "esriGeometryPolygon") {
                  this._createDrawTool(Draw.POLYGON);
                } else {
                  this._createDrawTool(Draw.POLYLINE);
                }
              })
            }, { "label": this.nls.common.no }]
          });
        }
      }));
    },

    /**
    * Create draw tool bar
    * @params {object} type of geometry
    * @memberOf widgets/Adopta/Widget
    */
    _createDrawTool: function (toolType) {
      var confirmAssetStatus;
      //Create toolbar instance
      this._toolBar = new Draw(this.map);
      //Disconnect map event handler and remove tooltip from map
      this._mapTooltipHandler.disconnectEventHandler();
      //Forcefully disable webmap popup
      this._mapTooltipHandler._disableWebMapPopup();
      this.mapClickHandler.pause();
      //activate the toolbar
      this._toolBar.activate(toolType);
      //close popup
      this._confirmationBox.close();
      this._toolBar.on("draw-end", lang.hitch(this, function (feature) {
        this._addGraphicsToMap(feature);
        confirmAssetStatus = new Message({
          message: this.nls.assetConfirmationMsg,
          type: "question",
          buttons: [{
            "label": this.nls.common.yes, "onClick": lang.hitch(this, function () {
              confirmAssetStatus.close();
              this._loading.show();
              this._addNewFeature(feature.geometry);
            })
          }, {
              "label": this.nls.common.no, "onClick": lang.hitch(this, function () {
                confirmAssetStatus.close();
                this._resetMapHandlers();
              })
            }]
        });
      }));
    },

    /**
    * connect/disconnect map events based on response
    * @memberOf widgets/Adopta/Widget
    */
    _resetMapHandlers: function () {
      this._toolBar.deactivate();
      this.map.graphics.clear();
      this._mapTooltipHandler.connectEventHandler();
      this.mapClickHandler.resume();
    },

    /**
    * Add drawn graphics to layer
    * @params {object} features geometry
    * @memberOf widgets/Adopta/Widget
    */
    _addGraphicsToMap : function (feature) {
      var symbol;
      if (feature.geometry.type === "polyline") {
        symbol = new SimpleLineSymbol();
      } else {
        symbol = new SimpleFillSymbol();
      }
      var graphic = new Graphic(feature.geometry, symbol);
      this.map.graphics.add(graphic);
    },

    /**
    * Add new asset in the layer at the selected location
    * @params {Object} mapPoint
    * @memberOf widgets/Adopta/Widget
    */
    _addNewFeature: function (mapPoint) {
      var newAssetGraphic;
      newAssetGraphic = new Graphic();
      newAssetGraphic.attributes = {};
      newAssetGraphic.geometry = lang.clone(mapPoint);
      // Add feature to the layer
      this._assetLayer.applyEdits([newAssetGraphic], null, null,
        lang.hitch(this, function (addResults) {
          this._loading.hide();
          //once new asset is added to the layer, adopt it.
          if (addResults[0].success) {
            this._assetDetails.fetchSelectedAsset(addResults[0].objectId).then(lang.hitch(this,
              function (response) {
              this._assetDetails.getSelectedAssetDetails(response);
            }));
          } else {
            this._showMessage(this.config.unableToAddNewAssetMsg);
          }
          if (this._toolBar) {
            this._resetMapHandlers();
          }
        }), lang.hitch(this, function () {
          this._loading.hide();
          this._showMessage(this.config.unableToAddNewAssetMsg);
        }));
    },

    /**
    * Listen for sign in event and perform necessary actions
    * @params {Object} userDetails containing user info
    * @memberOf widgets/Adopta/Widget
    */
    _onSignedIn: function (message) {
      //Dont show the tooltip once user is logged in
      this._showtooltip = false;
      this._mapTooltipHandler.disconnectEventHandler();
      this._showStatusMessage(message);
    },

    /**
    * Returns newURL by adding the param
    * @param {string} url
    * @param {string} paramName
    * @param {string} paramValue
    * @memberOf widgets/Adopta/Widget
    */
    _addUrlParams: function (url, paramName, paramValue) {
      var newURL = url;
      newURL = jimuUtils.url.addQueryParamToUrl(url, paramName, paramValue);
      return newURL;
    },

    /**
    * This function initialize asset detail widget
    * @memberOf widgets/Adopta/Widget
    */
    _createAssetDetailsPanel: function () {
      this._assetDetails = new AssetDetails({
        config: this.config,
        map: this.map,
        nls: this.nls,
        layer: this._assetLayer,
        loading: this._loading
      }, domConstruct.create("div", {}, this.assetInfoSection));
      //Listen for asset adopted event
      on(this._assetDetails, "assetAdopted", lang.hitch(this, function (objectId) {
        this._myAssetsInstance.setSelectedAsset(objectId);
        //Passing false value will not perform actions from URL
        this._myAssetsInstance.getMyAssets(false);
      }));
      //Listen for additional actions performed on selected asset and update my assets view
      on(this._assetDetails, "actionPerformed", lang.hitch(this, function (actionName, objectId) {
        this._myAssetsInstance.onActionPerformed(actionName, objectId);
      }));
      //Show asset details panel
      on(this._assetDetails, "showPanel", lang.hitch(this, function (currentNode) {
        this._showPanel(currentNode);
      }));
      //Show appropriate messsage
      on(this._assetDetails, "showMessage", lang.hitch(this, function (message) {
        this._showMessage(message);
      }));
      //Add url params on adopting a asset
      on(this._assetDetails, "adoptAsset", lang.hitch(this, function (objectId) {
        this._loginInstance.addURLParams(this.config.actions.assign.urlParameterLabel, objectId);
      }));
      //Highlight feature on map
      on(this._assetDetails, "highlightFeatureOnMap", lang.hitch(this, function (selectedFeature) {
        this._highlightFeatureOnMap(selectedFeature, true);
      }));

      on(this._assetDetails, "updateActionsInAssets", lang.hitch(this, function (actionsObject) {
        this._myAssetsInstance._actionPerformed = actionsObject;
      }));

      on(this._assetDetails, "showMyAssets", lang.hitch(this, function () {
        this._myAssetsInstance.showMyAssets();
        this._showPanel("myAsset");
        this._handleNavigationArrowVisibility(false, true);
      }));
    },

    /**
    * This function initialize the login widget
    * @memberOf widgets/Adopta/Widget
    */
    _createMyAssetsInstance: function () {
      // create an instance of login
      this._myAssetsInstance = new MyAssets({
        nls: this.nls,
        config: this.config,
        layer: this._assetLayer,
        loading: this._loading
      }, domConstruct.create("div", {}, this.myAssetsSection));
      this._myAssetsInstance.on("showMessage", lang.hitch(this, this._showMessage));

      on(this._myAssetsInstance, "updateMyAssetCount", lang.hitch(this, function (count) {
        if (count > 0) {
          if (window.isRTL) {
            domAttr.set(this.myAssestsBtn, "innerHTML", " (" + count + ")" +
              this.config.userDetails[this.config.emailField]);
          }
          else {
            domAttr.set(this.myAssestsBtn, "innerHTML",
              this.config.userDetails[this.config.emailField] + " (" + count + ")");
          }
          //Show next button to navigate userto list of adopted assets
          domClass.remove(this.myAssestsNextButton, "esriCTHidden");
        } else {
          //set only the logged in user email as innerHTML to my asset button
          domAttr.set(this.myAssestsBtn, "innerHTML",
            this.config.userDetails[this.config.emailField]);
          //Hide next button since no assets are adopted by logged in user
          domClass.add(this.myAssestsNextButton, "esriCTHidden");
        }
      }));

      on(this._myAssetsInstance, "performAction", lang.hitch(this,
      function (action, selectedAsset, showAssetDetails) {
        this._assetDetails.updateFieldsForAction(action, selectedAsset, showAssetDetails);
        if (showAssetDetails) {
          this._highlightFeatureOnMap(selectedAsset, true);
        }
      }));

      on(this._myAssetsInstance, "showAssetDetails", lang.hitch(this,
      function (selectedAsset, totalCount) {
        //set the logged in user email  and count of my assets as innerHTML to my asset button
        if (window.isRTL) {
          domAttr.set(this.myAssestsBtn, "innerHTML", " (" + totalCount + ")" +
          this.config.userDetails[this.config.emailField]);
        } else {
          domAttr.set(this.myAssestsBtn, "innerHTML",
              this.config.userDetails[this.config.emailField] + " (" + totalCount + ")");
        }
        this._assetDetails.showAssetInfoPopup(selectedAsset);
        this._highlightFeatureOnMap(selectedAsset, true);
      }));

      //Highlight feature on map
      on(this._myAssetsInstance, "highlightMyAsset", lang.hitch(this, function (selectedFeature) {
        this._highlightFeatureOnMap(selectedFeature, false);
      }));

      on(this._myAssetsInstance, "updateActionsInDetails", lang.hitch(this,
        function (actionsObject) {
        this._assetDetails.actionPerformedInDetails = actionsObject;
      }));
    },

    /**
    * Show list of adopted assets
    * @memberOf widgets/Adopta/Widget
    */
    _myAssestsBtnClicked: function () {
      if (lang.trim(domAttr.get(this.myAssestsBtn, "innerHTML")) === this.nls.loginSignUpLabel) {
        this._showPanel("login");
      } else {
        //If the selected asset was abandoned, we need to clear the selected map graphics
        //because the asset will not be present on myassets list
        if (!this._myAssetsInstance.getSelectedAsset() ||
          this._myAssetsInstance.myAssets.length === 0) {
          this._clearGraphics();
        }
        if (this._myAssetsInstance && this._myAssetsInstance.myAssets.length > 0) {
          if (domClass.contains(this._myAssetsInstance.selectAssetSection, "esriCTHidden") &&
            this._prevOpenPanel !== "assetDetails") {
            this._myAssetsInstance.showSelectAssetSection();
            this._handleNavigationArrowVisibility(true, false);
          } else {
            this._myAssetsInstance.showMyAssets();
            this._showPanel("myAsset");
            this._handleNavigationArrowVisibility(false, true);
          }
        } else {
          this._myAssetsInstance.showSelectAssetSection();
          this._showPanel("myAsset");
          this._handleNavigationArrowVisibility(false, false);
        }
      }
    },

    /**
    * Resize the widget components and connect map click on widget open
    * @memberOf widgets/Adopta/Widget
    */
    onOpen: function () {
      if (this._isValidConfig) {
        this._mapTooltipHandler.connectEventHandler();
        //If user is logged in, connect map click handler
        if (this.mapClickHandler && this.config.userDetails) {
          this.mapClickHandler.resume();
        }
      }
    },

    /**
    * Disconnect map click on widget close
    * @memberOf widgets/Adopta/Widget.js
    */
    onClose: function () {
      if (this._isValidConfig) {
        this._mapTooltipHandler.disconnectEventHandler();
        //on widget close, disconnect map click handler
        if (this.mapClickHandler) {
          this.mapClickHandler.pause();
        }
        //If tool bar is active, deactivate tool bar on widget close
        if(this._toolBar){
          this._toolBar.deactivate();
        }
      }
    },

    /**
    * This function validates the configured data
    * @memberOf widgets/Adopta/Widget
    */
    _validateConfig: function () {
      //If asset layer is not configured in the layer or
      //Configured layer is not available in webmap display error
      if (!this.config.assetLayerDetails || !this.map.getLayer(this.config.assetLayerDetails.id)) {
        this._displayWidgetError(this.nls.invalidConfigurationMessage);
        return false;
      }
      //if gpservice url or foreign key field is not configured display error
      if (!this.config.authGPServiceURL || !this.config.foreignKeyFieldForUserTable ||
        this.config.foreignKeyFieldForUserTable === "") {
        this._displayWidgetError(this.nls.invalidConfigurationMessage);
        return false;
      }
      return true;
    },

    /**
    * Display error message in error node
    * @memberOf widgets/Adopta/Widget
    */
    _displayWidgetError: function (msg) {
      if (this.widgetErrorNode) {
        domAttr.set(this.widgetErrorNode, "innerHTML", msg);
      }
      this._showMessage(msg);
    },

    /**
    * Create and show alert message.
    * @param {string} msg
    * @memberOf widgets/Adopta/Widget
    **/
    _showMessage: function (msg) {
      var alertMessage = new Message({
        message: msg,
        buttons: [{
          "label": this.nls.common.ok
        }]
      });
      alertMessage.message = msg;
    },

    /**
    * Displays selected panel
    * @param {string} panel name
    * @memberOf widgets/Adopta/Widget
    **/
    _showPanel: function (currentPanel) {
      var prevNode, currentNode;
      //check if previous panel exist and hide it
      if (this._prevOpenPanel) {
        prevNode = this._getNodeByName(this._prevOpenPanel);
        domClass.add(prevNode, "esriCTHidden");
      }
      //get current panel to be displayed and show it
      currentNode = this._getNodeByName(currentPanel);
      domClass.remove(currentNode, "esriCTHidden");
      //set the current panel as previous panel
      this._prevOpenPanel = currentPanel;
    },

    /**
    * Get panel node from panel name
    * @param {string} panel name
    * @memberOf widgets/Adopta/Widget
    **/
    _getNodeByName: function (panelName) {
      var node;
      switch (panelName) {
        case "login":
          node = this.loginSection;
          break;
        case "myAsset":
          node = this.myAssetsSection;
          break;
        case "assetDetails":
          node = this.assetInfoSection;
          this._handleNavigationArrowVisibility(false, true);
          break;
      }
      return node;
    },

    /**
    * This function used for loading indicator
    * @memberOf widgets/Adopta/Widget
    */
    _initLoading: function () {
      this._loading = new LoadingIndicator({
        hidden: true
      });
      this._loading.placeAt(this.domNode);
      this._loading.startup();
    },

    /**
    * clear graphics from map
    * @memberOf widgets/Adopta/Widget
    **/
    _clearGraphics: function () {
      if (this._featureGraphicsLayer) {
        this._featureGraphicsLayer.clear();
      }
    },

    /**
    * Resize the widget components on widget resize
    * @memberOf widgets/Adopta/Widget
    */
    resize: function () {
      if(this._loginInstance){
        this._loginInstance.calculateHight();
      }
    },

    /* Section For Highlighting Selected Point Feature */

    /**
    * highlight selected feature on map
    * @memberOf widgets/Adopta/Widget
    **/
    _highlightFeatureOnMap: function (selectedFeature, isCenterAndZoom) {
      var highlightSymbol;
      //highlight features on map only if layer is visible
      if (this._assetLayer.visible) {
        this._clearGraphics();
        highlightSymbol = this.getHighLightSymbol(selectedFeature, this._assetLayer);
        if (highlightSymbol) {
          this._featureGraphicsLayer.add(highlightSymbol);
        }
        if (this._myAssetsInstance) {
          this._myAssetsInstance.highlightItem(
            selectedFeature.attributes[this._assetLayer.objectIdField]);
        }
        //If asset is selected through my asset list panel, bring the selected feature to the center of map
        if (isCenterAndZoom) {
          if (selectedFeature.geometry.type === "point") {
            this.map.centerAt(selectedFeature.geometry);
          } else {
            this.map.setExtent(selectedFeature.geometry.getExtent());
          }
        }
      }
    },

    /**
    * Get symbol used for highlighting feature
    * @param{object} selected feature which needs to be highlighted
    * @param{object} details of selected layer
    */
    getHighLightSymbol: function (graphic, layer) {
      // If feature geometry is of type point, add a crosshair symbol
      // If feature geometry is of type polyline, highlight the line
      // If feature geometry is of type polygon, highlight the boundary of the polygon
      switch (graphic.geometry.type) {
        case "point":
          return this._getPointSymbol(graphic, layer);
        case "polyline":
          return this._getPolyLineSymbol(graphic, layer);
        case "polygon":
          return this._getPolygonSymbol(graphic);
      }
    },

    /**
    * This function is used to get symbol for point geometry
    * @param{object} selected feature which needs to be highlighted
    * @param{object} details of selected layer
    * @memberOf widgets/Adopta/Widget
    */
    _getPointSymbol: function (graphic, layer) {
      var symbol, isSymbolFound, graphics, point, graphicInfoValue,
        layerInfoValue, i;
      isSymbolFound = false;
      if (graphic.symbol) {
        symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,
          null, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
            new Color(this.config.highlightColor), 3));
        symbol.setColor(null);
        symbol.size = 30; //set default Symbol size which will be used in case symbol not found.
        point = new Point(graphic.geometry.x, graphic.geometry.y,
          new SpatialReference({ wkid: graphic.geometry.spatialReference.wkid })
        );
        symbol = this._updatePointSymbolProperties(symbol, graphic.symbol);
        graphics = new Graphic(point, symbol, graphic.attributes);
      } else {
        symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,
          null, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
            new Color(this.config.highlightColor), 3));
        symbol.setColor(null);
        symbol.size = 30; //set default Symbol size which will be used in case symbol not found.
        //check if layer is valid and have valid renderer object then only check for other symbol properties
        if (layer && layer.renderer) {
          if (layer.renderer.symbol) {
            isSymbolFound = true;
            symbol = this._updatePointSymbolProperties(symbol, layer.renderer
              .symbol);
          } else if (layer.renderer.infos && (layer.renderer.infos.length >
            0)) {
            for (i = 0; i < layer.renderer.infos.length; i++) {
              if (layer.typeIdField) {
                graphicInfoValue = graphic.attributes[layer.typeIdField];
              } else if (layer.renderer.attributeField) {
                graphicInfoValue = graphic.attributes[layer.renderer.attributeField];
              }
              layerInfoValue = layer.renderer.infos[i].value;
              // To get properties of symbol when infos contains other than class break renderer.
              if (graphicInfoValue !== undefined && graphicInfoValue !==
                null && graphicInfoValue !== "" && layerInfoValue !==
                undefined && layerInfoValue !== null && layerInfoValue !==
                "") {
                if (graphicInfoValue.toString() === layerInfoValue.toString()) {
                  isSymbolFound = true;
                  symbol = this._updatePointSymbolProperties(symbol,
                    layer.renderer.infos[i].symbol);
                }
              }
            }
            if (!isSymbolFound) {
              if (layer.renderer.defaultSymbol) {
                isSymbolFound = true;
                symbol = this._updatePointSymbolProperties(symbol,
                  layer.renderer.defaultSymbol);
              }
            }
          }
        }
        point = new Point(graphic.geometry.x, graphic.geometry.y, new SpatialReference({
          wkid: graphic.geometry.spatialReference.wkid
        }));
        graphics = new Graphic(point, symbol, graphic.attributes);
      }
      return graphics;
    },

    /**
    * This function is used to get different data of symbol from infos properties of renderer object.
    * @param{object} symbol that needs to be assigned to selected/activated feature
    * @param{object} renderer layer Symbol
    * @memberOf widgets/Adopta/Widget
    */
    _updatePointSymbolProperties: function (symbol, layerSymbol) {
      var height, width, size;
      if (layerSymbol.hasOwnProperty("height") && layerSymbol.hasOwnProperty(
        "width")) {
        height = layerSymbol.height;
        width = layerSymbol.width;
        // To display cross hair properly around feature its size needs to be calculated
        size = (height > width) ? height : width;
        size = size + 10;
        symbol.size = size;
      }
      if (layerSymbol.hasOwnProperty("size")) {
        if (!size || size < layerSymbol.size) {
          symbol.size = layerSymbol.size + 10;
        }
      }
      if (layerSymbol.hasOwnProperty("xoffset")) {
        symbol.xoffset = layerSymbol.xoffset;
      }
      if (layerSymbol.hasOwnProperty("yoffset")) {
        symbol.yoffset = layerSymbol.yoffset;
      }
      return symbol;
    },

    /**
    * This function is used to get symbol for polyline geometry
    * @param{object} selected feature which needs to be highlighted
    * @param{object} details of selected layer
    */
    _getPolyLineSymbol: function (graphic, layer) {
      var symbol, graphics, polyline, symbolWidth, graphicInfoValue, layerInfoValue, i;
      symbolWidth = 5; // default line width
      //check if layer is valid and have valid renderer object then only check for other  symbol properties
      if (layer && layer.renderer) {
        if (layer.renderer.symbol && layer.renderer.symbol.hasOwnProperty("width")) {
          symbolWidth = layer.renderer.symbol.width;
        } else if ((layer.renderer.infos) && (layer.renderer.infos.length > 0)) {
          for (i = 0; i < layer.renderer.infos.length; i++) {
            if (layer.typeIdField) {
              graphicInfoValue = graphic.attributes[layer.typeIdField];
            } else if (layer.renderer.attributeField) {
              graphicInfoValue = graphic.attributes[layer.renderer.attributeField];
            }
            layerInfoValue = layer.renderer.infos[i].value;
            // To get properties of symbol when infos contains other than class break renderer.
            if (graphicInfoValue !== undefined && graphicInfoValue !== null &&
              graphicInfoValue !== "" && layerInfoValue !== undefined &&
              layerInfoValue !== null && layerInfoValue !== "") {
              if (graphicInfoValue.toString() === layerInfoValue.toString() &&
                layer.renderer.infos[i].symbol.hasOwnProperty("width")) {
                symbolWidth = layer.renderer.infos[i].symbol.width;
              }
            }
          }
        } else if (layer.renderer.defaultSymbol && layer.renderer.defaultSymbol
          .hasOwnProperty("width")) {
          symbolWidth = layer.renderer.defaultSymbol.width;
        }
      }
      symbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(
        this.config.highlightColor), symbolWidth);
      polyline = new Polyline(new SpatialReference({
        wkid: graphic.geometry.spatialReference.wkid
      }));
      if (graphic.geometry.paths && graphic.geometry.paths.length > 0) {
        polyline.addPath(graphic.geometry.paths[0]);
      }
      graphics = new Graphic(polyline, symbol, graphic.attributes);
      return graphics;
    },

    /**
    * This function is used to get symbol for polygon geometry
    * @param{object} selected feature which needs to be highlighted
    * @param{object} details of selected layer
    */
    _getPolygonSymbol: function (graphic) {
      var symbol, graphics, polygon;
      symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(
        SimpleLineSymbol.STYLE_SOLID, new Color(this.config.highlightColor), 4), new Color(
        [0, 0, 0, 0]));
      polygon = new Polygon(new SpatialReference({
        wkid: graphic.geometry.spatialReference.wkid
      }));
      if (graphic.geometry.rings) {
        polygon.rings = lang.clone(graphic.geometry.rings);
      }
      graphics = new Graphic(polygon, symbol, graphic.attributes);
      return graphics;
    },

    /* End Of Section For Highlighting Selected Point Feature */

    /**
    * Function is used to show appropriate message after completion of task
    * @param{boolean} flag which indicates wether the job was successfull/failed
    * @memberOf widgets/Adopta/Widget
    */
    _showStatusMessage: function (message) {
      domClass.add(this.widgetMainNode, "esriCTHidden");
      domAttr.set(this.loginStatusMessage, "innerHTML", message);
      domClass.remove(this.loginStatusMessage, "esriCTHidden");
    },

    /**
    * Function is used show/hide navigation arrows
    * @param{boolean} visibilty of next arrow
    * @param{boolean} visibilty of previous arrow
    * @memberOf widgets/Adopta/Widget
    */
    _handleNavigationArrowVisibility: function (isNextArrowRequired, isPrevArrowRequired) {
      if (isNextArrowRequired) {
        domClass.remove(this.myAssestsNextButton, "esriCTHidden");
      } else {
        domClass.add(this.myAssestsNextButton, "esriCTHidden");
      }
      if (isPrevArrowRequired) {
        domClass.remove(this.myAssestsPrevButton, "esriCTHidden");
      } else {
        domClass.add(this.myAssestsPrevButton, "esriCTHidden");
      }

    },

    /**
    * Returns the title to be shown in my asset list of the selected feature
    * @param {Object} selectedFeature
    * @memberOf widgets/Adopta/MyAssets
    **/
    _getAssetTitle: function (selectedFeature) {
      var assetTitle;
      if (lang.trim(this.config.nickNameField) !== "" &&
        selectedFeature.attributes[this.config.nickNameField] &&
        lang.trim(selectedFeature.attributes[this.config.nickNameField]) !== "") {
        assetTitle = lang.trim(selectedFeature.attributes[this.config.nickNameField]);
      } else if (selectedFeature.getTitle() && lang.trim(selectedFeature.getTitle()) !== "") {
        assetTitle = lang.trim(selectedFeature.getTitle());
      } else if (selectedFeature.attributes[this._assetLayer.displayField]) {
        assetTitle = selectedFeature.attributes[this._assetLayer.displayField];
      } else {
        assetTitle = selectedFeature.attributes[this._assetLayer.objectIdField];
      }
      return assetTitle;
    },

    /* Get selected Theme Color*/

    /**
    * Function is used to get the configured theme color
    * @memberOf widgets/Adopta/Widget
    */
    _getSelectedThemeColor: function () {
      var requestArgs, styleName, selectedTheme;
      //Get selected theme Name
      selectedTheme = this.appConfig.theme.name;
      //get selected theme's style
      if (this.appConfig && this.appConfig.theme && this.appConfig.theme.styles) {
        styleName = this.appConfig.theme.styles[0];
      } else {
        styleName = "default";
      }
      //cerate request to get the selected theme's manifest to fetch the color
      requestArgs = {
        url: "./themes/" + selectedTheme + "/manifest.json",
        content: {
          f: "json"
        },
        handleAs: "json",
        callbackParamName: "callback"
      };
      esriRequest(requestArgs).then(lang.hitch(this, function (response) {
        var i, styleObj;
        //match the selected style name and get its color
        if (response && response.styles && response.styles.length > 0) {
          for (i = 0; i < response.styles.length; i++) {
            styleObj = response.styles[i];
            if (styleObj.name === styleName) {
              this.config.selectedThemeColor = styleObj.styleColor;
              break;
            }
          }
        }
        //if selectedThemeColor is not set then by default use black
        if (!this.config.selectedThemeColor) {
          this.config.selectedThemeColor = "#000000";
        }
      }), lang.hitch(this, function () {
        this.config.selectedThemeColor = "#000000";
      }));
    }
    /*End get selected theme color*/
  });
});