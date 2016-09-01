define([
  'dojo/_base/declare',
  'dojo/_base/array',
  'jimu/BaseWidget',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/text!./MyAssets.html',
  'dojo/_base/lang',
  'dojo/Evented',
  'dojo/dom-class',
  'dojo/dom-style',
  'esri/tasks/query',
  'dojo/dom-construct',
  'dojo/dom-attr',
  'dojo/on',
  'dojo/query',
  'esri/symbols/jsonUtils',
  'jimu/utils',
  'dojo/string'
], function (
  declare,
  array,
  BaseWidget,
  _WidgetsInTemplateMixin,
  MyAssetsTemplate,
  lang,
  Evented,
  domClass,
  domStyle,
  Query,
  domConstruct,
  domAttr,
  on,
  query,
  symbolJsonUtils,
  jimuUtils,
  string
) {
  return declare([BaseWidget, _WidgetsInTemplateMixin, Evented], {
    baseClass: 'jimu-widget-Adopta-MyAssets',
    templateString: MyAssetsTemplate, //set template string
    myAssets: null,
    _primaryAction: null,
    _updateLayerTimer: null,
    _actionPerformed: {},
    _selectedAsset: null,
    constructor: function (options) {
      lang.mixin(this, options);
    },

    postCreate: function () {
      this.inherited(arguments);
      domClass.add(this.domNode, "esriCTFullHeight");
      //get primary action (i.e. action to be displayed in my asset list)
      this._setPrimaryAction();

      this.own(on(this.layer, "update-end", lang.hitch(this, function () {
        if (this._updateLayerTimer && this.myAssets && this.myAssets.length > 0) {
          clearTimeout(this._updateLayerTimer);
        }
        this._updateLayerTimer = setTimeout(lang.hitch(this, function () {
          if (this.config.userDetails) {
            var queryField, i;
            queryField = new Query();
            queryField.where = this.config.foreignKeyFieldForUserTable + " = '{" +
              this.config.userDetails[this.config.foreignKeyFieldForUserTable] + "}'";
            queryField.returnGeometry = true;
            queryField.outFields = ["*"];
            // Query for the features with the loggedin UserID
            this.layer.queryFeatures(queryField, lang.hitch(this, function (
                response) {
              for (i = 0; i < response.features.length; i++) {
                //update symbol in layer of myassets
                this._updateSymbol(response.features[i]);
              }
            }));
            this._updateLayerTimer = null;
          }
        }), 100);
      })));
      domAttr.set(this.selectAssetSection, "innerHTML", jimuUtils.sanitizeHTML(
        this.config.selectAssetMsg));
    },

    /**
    * Set's primary action to be considered from the configuration
    * @memberOf widgets/Adopta/MyAssets
    **/
    _setPrimaryAction: function () {
      var i;
      for (i = 0; i < this.config.actions.additionalActions.length; i++) {
        if (this.config.actions.additionalActions[i].displayInMyAssets) {
          this._primaryAction = lang.clone(this.config.actions.additionalActions[i]);
          break;
        }
      }
    },

    /**
    * Display list of my assets
    * @memberOf widgets/Adopta/MyAssets
    **/
    showMyAssets: function () {
      domClass.add(this.selectAssetSection, "esriCTHidden");
      domClass.remove(this.myAssetsSection, "esriCTHidden");
    },

    /**
    * Display list of my assets
    * @memberOf widgets/Adopta/MyAssets
    **/
    showSelectAssetSection: function () {
      domClass.remove(this.selectAssetSection, "esriCTHidden");
      domClass.add(this.myAssetsSection, "esriCTHidden");
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
      } else if (selectedFeature.attributes[this.layer.displayField] &&
        selectedFeature.attributes[this.layer.displayField] !== "") {
        assetTitle = selectedFeature.attributes[this.layer.displayField];
      } else {
        assetTitle = this.layer.name + " : " +
          selectedFeature.attributes[this.layer.objectIdField];
      }
      return assetTitle;
    },

    /**
    * Create the list of my assets
    * @memberOf widgets/Adopta/MyAssets
    **/
    createMyAssets: function () {
      var item, i, itemHighlighter, itemTitle, itemActionText, itemActionButton,
      itemActionImage, itemActionContainer, objectId;
      //clear previously added my assets
      domConstruct.empty(this.myAssetsSection);
      if (this.myAssets && this.myAssets.length > 0) {
        for (i = 0; i < this.myAssets.length; i++) {
          this._updateSymbol(this.myAssets[i]);
          item = domConstruct.create("div", {
            "class": "esriCTListItem"
          }, this.myAssetsSection);

          objectId = this.myAssets[i].attributes[this.layer.objectIdField];
          if (this._primaryAction) {
            itemActionContainer = domConstruct.create("div", {
              "class": "esriCTItemActionContainer"
            }, item);
            itemActionText = domConstruct.create("div", {
              "innerHTML": jimuUtils.sanitizeHTML(this._primaryAction.name),
              "title": jimuUtils.sanitizeHTML(this._primaryAction.name),
              "class": "esriCTItemActionText esriCTEllipsis"
            }, itemActionContainer);
            itemActionButton = domConstruct.create("div", {
              "class": "esriCTPrimaryActionImageContainer"
            }, itemActionContainer);
            //if action is already performed, remove button and add green check image
            if (this._actionPerformed.hasOwnProperty(objectId) &&
              this._actionPerformed[objectId].indexOf(this._primaryAction.name) !== -1) {
              domClass.add(itemActionContainer, "esriCTActionPerformed");
              itemActionImage = domConstruct.create("img", {
                "class": "esriCTimageDimensions"
              }, itemActionButton);
              // fetch image data/url
              this._createImageFromData(this.config.afterActionImage, itemActionImage);
            } else {
              itemActionImage = domConstruct.create("img", {
                "class": "esriCTimageDimensions"
              }, itemActionButton);
              // fetch image data/url
              this._createImageFromData(this.config.beforeActionImage, itemActionImage);
              domClass.remove(itemActionContainer, "esriCTActionPerformed");
            }
            //set attributes to div which can be used to fetch feature from myAsset array
            domAttr.set(itemActionContainer, "assetId", i);
            //set action attribute to action button
            domAttr.set(itemActionContainer, "action", this._primaryAction.name);
            this.own(on(itemActionContainer, "click", lang.hitch(this, this.performAction)));
          }
          itemHighlighter = domConstruct.create("div", {
            "class": "esriCTListItemHighlight"
          }, item);
          itemTitle = domConstruct.create("div", {
            "class": "esriCTListItemTitle esriCTCursorPointer esriCTEllipsis"
          }, item);

          domAttr.set(item, "assetId", i);
          domAttr.set(item, "objectId", this.myAssets[i].attributes[this.layer.objectIdField]);
          //set asset title & action button title
          domAttr.set(itemTitle, "innerHTML", this._getAssetTitle(this.myAssets[i]));
          domAttr.set(itemTitle, "title", this._getAssetTitle(this.myAssets[i]));
          //handle click events to show asset details
          this.own(on(item, "click", lang.hitch(this, this._showAssetDetails)));

          //If asset is aleady selected highlight it
          if (this._selectedAsset && this._selectedAsset.toString() ===
            this.myAssets[i].attributes[this.layer.objectIdField].toString()) {
            this._highlightRow(item);
            this.emit("highlightMyAsset", this.myAssets[i]);
          }
        }
      } else {
        domClass.remove(this.selectAssetSection, "esriCTHidden");
        domClass.add(this.myAssetsSection, "esriCTHidden");
      }
    },

    _createImageFromData : function (action, imageNode) {
      var baseURL, imageSrc;
      if (action) {
        if (action.imageData.indexOf("${appPath}") > -1) {
          baseURL = location.href.slice(0, location.href.lastIndexOf(
            '/'));
          imageSrc = string.substitute(action.imageData, {
            appPath: baseURL
          });
        } else {
          imageSrc = action.imageData;
        }
      }
      domAttr.set(imageNode, "src", imageSrc);
    },

    /**
    * Update feature symbol
    * @memberOf widgets/Adopta/MyAssets
    **/
    _updateSymbol: function (feature) {
      var baseURL;
      if (feature.geometry.type === "point") {
        //Check for "${appPath} and replace it with application base url"
        if (this.config.myAssetSymbol.imageData.indexOf("${appPath}") > -1) {
          baseURL = location.href.slice(0, location.href.lastIndexOf(
            '/'));
          this.config.myAssetSymbol.url = string.substitute(
            this.config.myAssetSymbol.imageData, {
              appPath: baseURL
            });
          this.config.myAssetSymbol.imageData = "";
          //Check for "${apps}" and then append base url
        } else if (this.config.myAssetSymbol.imageData.indexOf("apps") > -1) {
          baseURL = location.href.split('/webappbuilder');
          this.config.myAssetSymbol.url = baseURL[0] + this.config.myAssetSymbol.imageData;
          this.config.myAssetSymbol.imageData = "";
        }
        //Check if imageData contains ',', then split and use the appropriate string
        if (this.config.myAssetSymbol.imageData && this.config.myAssetSymbol.imageData
          .indexOf(",") > -1) {
          this.config.myAssetSymbol.imageData = this.config.myAssetSymbol.imageData.split(",")[1];
        }
      }
      var symbol = symbolJsonUtils.fromJson(this.config.myAssetSymbol);
      feature.setSymbol(symbol);
    },

    /**
    * Emits event to display asset details using selected feature
    * @param {Object} evt contains the node on which clicked
    * @memberOf widgets/Adopta/MyAssets
    **/
    _showAssetDetails: function (evt) {
      var assetIndex;
      assetIndex = domAttr.get(evt.currentTarget, "assetId");
      this._highlightRow(evt.currentTarget);
      this.emit("showAssetDetails", this.myAssets[assetIndex], this.myAssets.length);
    },


    /**
    * Gets all the assets adopted by logged in user.
    * @param {boolean} flag to check for execution of actions
    * @memberOf widgets/Adopta/MyAssets
    **/
    getMyAssets: function (performActionsFromURL) {
      var queryField;
      queryField = new Query();
      queryField.where = this.config.foreignKeyFieldForUserTable + " = '{" +
        this.config.userDetails[this.config.foreignKeyFieldForUserTable] + "}'";
      queryField.returnGeometry = true;
      queryField.outFields = ["*"];
      // Query for the features with the loggedin UserID
      this.layer.queryFeatures(queryField, lang.hitch(this, function (
          response) {
        this.myAssets = response.features;
        this.createMyAssets();
        this.updateMyAssetCount();
        if (performActionsFromURL) {
          this._performActionFromURL();
        }
      }));
    },

    /**
    * Clear previously highlighted row
    * @memberOf widgets/Adopta/MyAssets
    **/
    _clearHighlightedRow: function () {
      var prevSelectedItem;
      prevSelectedItem = query(".esriCTItemSelected", this.myAssetsSection);
      if (prevSelectedItem && prevSelectedItem[0]) {
        domClass.remove(prevSelectedItem[0], "esriCTItemSelected");
        domStyle.set(prevSelectedItem[0], "backgroundColor", "transparent");
      }
    },

    /**
    * Highlight selected row
    * @param {object} current node
    * @memberOf widgets/Adopta/MyAssets
    **/
    _highlightRow: function (currentTarget) {
      var currentSelectedItem;
      this._clearHighlightedRow();
      currentSelectedItem = query(".esriCTListItemHighlight", currentTarget);
      if (currentSelectedItem && currentSelectedItem[0]) {
        domStyle.set(currentSelectedItem[0], "backgroundColor", this.config.selectedThemeColor);
        domClass.add(currentSelectedItem[0], "esriCTItemSelected");
        this._selectedAsset = domAttr.get(currentTarget, "objectId");
      }
    },

    /**
    * Fetch node to be highlighted or clear all the other nodes which are highlighted
    * @param {string} object id of selected asset
    * @memberOf widgets/Adopta/MyAssets
    **/
    highlightItem: function (objectid) {
      if (query("[objectId = " + objectid + "]", this.myAssetsSection).length > 0) {
        this._highlightRow(query("[objectId = " + objectid + "]", this.myAssetsSection)[0]);
      } else {
        this._selectedAsset = null;
        this._clearHighlightedRow();
      }
    },

    /**
    * Update my assets count
    * @memberOf widgets/Adopta/MyAssets
    **/
    updateMyAssetCount: function () {
      this.emit("updateMyAssetCount", this.myAssets.length);
    },

    /**
    * Update my assets count
    * @param {object} event object
    * @memberOf widgets/Adopta/MyAssets
    **/
    performAction: function (evt) {
      var action, assetIndex;
      if (!domClass.contains(evt.currentTarget, "esriCTActionPerformed")) {
        action = domAttr.get(evt.currentTarget, "action");
        assetIndex = domAttr.get(evt.currentTarget, "assetId");
        this.emit("performAction", action, this.myAssets[assetIndex], false);
        domClass.add(evt.currentTarget, "esriCTActionPerformed");
      }
      //stop propagating list click event
      evt.stopPropagation();
    },

    /**
    * Store objectids of feature where primary action is already performed
    * @param {string} current action name
    * @param {string} object id of selected asset
    * @memberOf widgets/Adopta/MyAssets
    **/
    onActionPerformed: function (actionName, objectId) {
      //if selected action is primary action
      if (this._primaryAction) {
        if (this._primaryAction.name === actionName) {
          //if selected action is performed on my asset
          if (this._actionPerformed && !this._actionPerformed.hasOwnProperty(objectId)) {
            this._actionPerformed.push(objectId);
          }
        }

        //If asset is abandoned, remove it from the actionPerformed array
        if (this._actionPerformed && this._actionPerformed.hasOwnProperty(objectId) &&
          actionName === this.config.actions.unAssign.name) {
          delete this._actionPerformed[objectId];
          this._selectedAsset = null;
        } else if (actionName === this.config.actions.unAssign.name) {
          this._selectedAsset = null;
        }
      }
      this.emit("updateActionsInDetails", this._actionPerformed);
      //update my assets
      this.getMyAssets();
    },

    /**
    * Set selected asset in my asset
    * @param {string} object id of selected asset
    * @memberOf widgets/Adopta/MyAssets
    **/
    getSelectedAsset: function () {
      return this._selectedAsset;
    },

    /**
    * Set selected asset in my asset
    * @param {string} object id of selected asset
    * @memberOf widgets/Adopta/MyAssets
    **/
    setSelectedAsset: function (objectId) {
      this._selectedAsset = objectId;
    },

    /**
    * Store objectids of feature where primary action is already performed
    * @memberOf widgets/Adopta/MyAssets
    **/
    _performActionFromURL: function () {
      var objectId, isActionPerformed = false, actionName;
      if (this.config.urlParams.hasOwnProperty(this.config.actions.unAssign.urlParameterLabel)) {
        actionName = this.config.actions.unAssign.name;
        array.some(this.myAssets, lang.hitch(this, function (currentGraphic) {
          if (currentGraphic.attributes[this.layer.objectIdField].toString() ===
            this.config.urlParams[this.config.actions.unAssign.urlParameterLabel].toString()) {
            this.emit("performAction", this.config.actions.unAssign.name, currentGraphic, true);
            isActionPerformed = true;
            return true;
          }
        }));
      } else {
        array.some(this.config.actions.additionalActions, lang.hitch(this,
          function (currentAction) {
          if (this.config.urlParams.hasOwnProperty(currentAction.urlParameterLabel)) {
            actionName = currentAction.name;
            array.some(this.myAssets, lang.hitch(this, function (currentGraphic) {
              if (currentGraphic.attributes[this.layer.objectIdField].toString() ===
                this.config.urlParams[currentAction.urlParameterLabel].toString()) {
                objectId = currentGraphic.attributes[this.layer.objectIdField];
                this.emit("performAction",
                  currentAction.name,
                  currentGraphic,
                  !currentAction.displayInMyAssets);
                //If action is primary do not show asset details panel
                if (currentAction.displayInMyAssets &&
                  query("[objectId = " + objectId + "]", this.myAssetsSection)[0]) {
                  this._highlightRow(query("[objectId = " + objectId + "]",
                    this.myAssetsSection)[0]);
                  this.emit("highlightMyAsset", currentGraphic);
                }
                isActionPerformed = true;
                return true;
              }
            }));
            return true;
          }
        }));
      }
      //if some action exist in url but not performed then show error msg
      if (actionName && !isActionPerformed) {
        this.emit("showMessage", string.substitute(this.config.unableToPerformAction,
          { actionName: actionName }));
      }
    }
  });
});