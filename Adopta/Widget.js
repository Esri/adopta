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
  'dojo/dom-construct',
  'esri/layers/GraphicsLayer',
  'esri/geometry/Point',
  'esri/graphic',
  'esri/SpatialReference',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/Color',
  'dojo/_base/array',
  'esri/tasks/Geoprocessor',
  'jimu/utils',
  'esri/request'
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
  domConstruct,
  GraphicsLayer,
  Point,
  Graphic,
  SpatialReference,
  SimpleLineSymbol,
  SimpleMarkerSymbol,
  Color,
  array,
  Geoprocessor,
  jimuUtils,
  esriRequest) {
  return declare([BaseWidget], {
    baseClass: 'jimu-widget-Adopta', //Widget base class name
    urlParamsToBeAdded: {}, //Parameters to be added in url which will be sent via email
    _isValidConfig: null, //Flag to check whether config has valid data for the widget
    _assetLayer: null, //Holds an object of configured asset layer from webmap
    _prevOpenPanel: null, //Holds the name of previously open panel
    _mapTooltipHandler: null, //Holds an instance of Map tooltip handler
    _assetDetails: null, //Holds an instance of AssetDetails
    _loading: null, //Loading indicator instance
    _featureGraphicsLayer: null, //Graphics layer to add highlight the features
    _showtooltip: true, //Flag to indicate whether to show the map tooltip or not

    postCreate: function () {
      this.inherited(arguments);
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
        //create login instance
        this._createLoginInstance();
        this._assetLayer = this.map.getLayer(this.config.assetLayerDetails.id);
        //get related key filed for the layer
        array.some(this._assetLayer.relationships, lang.hitch(this, function (currentRelationship) {
          if (currentRelationship.id === this.config.relatedTableDetails.relationShipId) {
            this.config.assetLayerDetails.keyField = currentRelationship.keyField;
            return true;
          }
        }));
        //Set Map Tooltip Handler
        this._createMapTooltipHandler();
        //Panel to show asset details
        this._createAssetDetailsPanel();
        //Panel to show my assets
        this._createMyAssetsInstance();
        on(this.loginInfoSectionPanel, "click", lang.hitch(this, this._myAssestsBtnClicked));
        //create & add graphics layer to highlight selected feature
        this._featureGraphicsLayer = new GraphicsLayer();
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
        loading: this._loading
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
        //once user is logged in the functionality to add assets will be enabled so update the tooltip
        this._mapTooltipHandler.updateTooltip();
        parameterLabel = this.config.actions.assign.urlParameterLabel;
        //check for url params has adoptId addopt the selected asset
        if (this.config.urlParams && this.config.urlParams.hasOwnProperty(parameterLabel)) {
          this._assetDetails.fetchSelectedAsset(this.config.urlParams[parameterLabel]);
        }
      }));
      this._loginInstance.on("signedIn", lang.hitch(this, this._onSignedIn));
      this._loginInstance.on("invalidLogin", lang.hitch(this, function () {
        this._showPanel("login");
        this._mapTooltipHandler.connectEventHandler();
      }));
    },

    /**
    * Listen for sign in event and perform necessary actions
    * @params {Object} userDetails containing user info
    * @memberOf widgets/Adopta/Widget
    */
    _onSignedIn: function (userDetails) {
      var appURL = window.location.href;
      this.urlParamsToBeAdded.userid = userDetails[this.config.relatedTableDetails.keyField];
      for (var key in this.urlParamsToBeAdded) {
        appURL = this._addUrlParams(appURL, key, this.urlParamsToBeAdded[key]);
      }
      //TODO: check an alternative to load app in builder mode and support the mode parameter
      appURL = jimuUtils.url.removeQueryParamFromUrl(appURL, "mode");
      this._executeGPTask(appURL, userDetails[this.config.emailField]);
      //Dont show the tooltip once user is logged in
      this._showtooltip = false;
      this._mapTooltipHandler.disconnectEventHandler();
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
        this.urlParamsToBeAdded[this.config.actions.assign.urlParameterLabel] = objectId;
      }));
      //Highlight feature on map
      on(this._assetDetails, "highlightFeatureOnMap", lang.hitch(this, function (selectedFeature) {
        this._highlightFeatureOnMap(selectedFeature, true);
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
      on(this._myAssetsInstance, "updateMyAssetCount", lang.hitch(this, function (count) {
        if (count > 0) {
          //set the logged in user email  and count of my assets as innerHTML to my asset button
          domAttr.set(this.myAssestsBtn, "innerHTML",
            this.config.userDetails[this.config.emailField] + " (" + count + ")");
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
        domAttr.set(this.myAssestsBtn, "innerHTML",
            this.config.userDetails[this.config.emailField] + " (" + totalCount + ")");
        this._assetDetails.showAssetInfoPopup(selectedAsset);
        this._highlightFeatureOnMap(selectedAsset, true);
      }));

      //Highlight feature on map
      on(this._myAssetsInstance, "highlightMyAsset", lang.hitch(this, function (selectedFeature) {
        this._highlightFeatureOnMap(selectedFeature, false);
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
        //If the selected asset was abonded, we need to clear the selected map graphics
        //beacuse the asset will not be present on myassets list
        if (!this._myAssetsInstance.getSelectedAsset()) {
          this._clearGrahics();
        }
        if (this._myAssetsInstance && this._myAssetsInstance.myAssets.length > 0) {
          if (domClass.contains(this._myAssetsInstance.selecetAssetSection, "esriCTHidden") &&
            this._prevOpenPanel !== "assetDetails") {
            this._myAssetsInstance.showSelectAsssetSection();
            this._handleNavigationArrowVisibility(true, false);
          }else {
            //TODO: remove msg, and show panel
            this._myAssetsInstance.showMyAssets();
            this._showPanel("myAsset");
            this._handleNavigationArrowVisibility(false, true);
          }
        } else {
          this._myAssetsInstance.showSelectAsssetSection();
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
      if (this._isValidConfig && this._showtooltip) {
        this._mapTooltipHandler.connectEventHandler();
      }
    },

    /**
    * Disconnect map click on widget close
    * @memberOf widgets/Adopta/Widget.js
    */
    onClose: function () {
      if (this._isValidConfig && this._showtooltip) {
        this._mapTooltipHandler.disconnectEventHandler();
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
      } else if (!this.config.gpServiceURL) { //if gpservice url is not configured display error
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
        message: msg
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
    _clearGrahics: function () {
      if (this._featureGraphicsLayer) {
        this._featureGraphicsLayer.clear();
      }
    },

    /* Section For Highlighting Selected Point Feature */

    /**
    * highlight selected feature on map
    * @memberOf widgets/Adopta/Widget
    **/
    _highlightFeatureOnMap: function (selectedFeature, isCenterAndZoom) {
      var graphics, point, symbol;
      //highlight features on map only if layer is visible
      if (this._assetLayer.visible) {
        this._clearGrahics();
        if (selectedFeature.symbol) {
          symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,
          null, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
          new Color(this.config.highlightColor), 3));
          symbol.setColor(null);
          symbol.size = 30; //set default Symbol size which will be used in case symbol not found.
          point = new Point(selectedFeature.geometry.x, selectedFeature.geometry.y,
            new SpatialReference({ wkid: selectedFeature.geometry.spatialReference.wkid })
            );
          symbol = this._updatePointSymbolProperties(symbol, selectedFeature.symbol);
          graphics = new Graphic(point, symbol, selectedFeature.attributes);
        } else {
          graphics = this._getPointSymbol(selectedFeature, this._assetLayer);
        }
        this._featureGraphicsLayer.add(graphics);
      }

      if (this._myAssetsInstance) {
        this._myAssetsInstance.highlightItem(
        selectedFeature.attributes[this._assetLayer.objectIdField]);
      }
      //If asset is selected through my asset list panel, bring the selected feature to the center of map
      if (isCenterAndZoom) {
        this.map.centerAt(point);
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

    /* End Of Section For Highlighting Selected Point Feature */

    /**
    * Funtion is used to send emails to respective email address
    * @param{string} application URL
    * @param{string} recipients email address
    * @memberOf widgets/Adopta/Widget
    */
    _executeGPTask: function (appURL, emailAddress) {
      var params = {
        "To_Address": emailAddress,
        "App_URL": appURL
      };
      this._loading.show();
      this._gpService.execute(params, lang.hitch(this, this._gpJobComplete),
        lang.hitch(this, this._gpJobFailed));
    },

    /**
    * Success call back
    * @param{object} status of excecuted job
    * @memberOf widgets/Adopta/Widget
    */
    _gpJobComplete: function (jobInfo) {
      if (jobInfo[0].value === "Success") {
        this._showStatusMessage(true);
      } else {
        this._showStatusMessage(false);
      }
      this._loading.hide();
    },

    /**
    * Error call back
    * @param{object} status of excecuted job
    * @memberOf widgets/Adopta/Widget
    */
    _gpJobFailed: function () {
      this._showStatusMessage(false);
      this._loading.hide();
    },

    /**
    * Function is used to show appropriate message after completion of task
    * @param{boolean} flag which indicates wether the job was successfull/failed
    * @memberOf widgets/Adopta/Widget
    */
    _showStatusMessage: function (isJobSuccessfull) {
      domClass.add(this.widgetMainNode, "esriCTHidden");
      if (!isJobSuccessfull) {
        domAttr.set(this.loginStatusMessage, "innerHTML", this.nls.gpServiceLoginFailedMsg);
      } else {
        domAttr.set(this.loginStatusMessage, "innerHTML", this.nls.gpServiceSuccessMsg);
      }
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