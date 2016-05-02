define([
  'dojo/_base/declare',
  'dojo/_base/array',
  'jimu/BaseWidget',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/text!./AssetDetails.html',
  'dojo/_base/lang',
  'dijit/layout/ContentPane',
  'dojo/on',
  'dojo/dom-construct',
  'dojo/dom-class',
  'dojo/dom-attr',
  'dijit/form/TextBox',
  'esri/tasks/locator',
  'esri/geometry/webMercatorUtils',
  'esri/tasks/query',
  'dojo/Evented',
  'dojo/string'
], function (
  declare,
  array,
  BaseWidget,
  _WidgetsInTemplateMixin,
  template,
  lang,
  ContentPane,
  on,
  domConstruct,
  domClass,
  domAttr,
  TextBox,
  Locator,
  webMercatorUtils,
  Query,
  Evented,
  string
) {
  return declare([BaseWidget, _WidgetsInTemplateMixin, Evented], {

    baseClass: 'jimu-widget-Adopta-AssetDetails',
    templateString: template,
    nickNameInputTextBox: null,
    layer: null,
    constructor: function (options) {
      lang.mixin(this, options);
    },

    postCreate: function () {
      domClass.add(this.domNode, "esriCTFullHeight");

      //create container to display feature popup info
      this._featureInfoPanel = new ContentPane({
        "id": 'divFeatureInfoContent'
      }, this.assetInfoPopupDetails);
      this._featureInfoPanel.startup();

      //Check for reverse geocoding Boolean flag
      if (this.config.showReverseGeocodedAddress) {
        domClass.remove(this.streetAddressContainer, "esriCTHidden");
        this._initReverseGeocoder();
      }
    },

    /**
    * Create details panel for selected asset
    * @param {object} selected feature
    * @memberOf widgets/Adopta/AssetDetails
    */
    showAssetInfoPopup: function (selectedFeature) {
      var assetStatus;
      this.selectedFeature = selectedFeature;
      this.showPanel("assetDetails");
      this._featureInfoPanel.setContent(this.selectedFeature.getContent());
      if (this._locatorInstance) {
        this._locatorInstance.locationToAddress(webMercatorUtils.webMercatorToGeographic(
        selectedFeature.geometry), 100);
      }
      assetStatus = this._checkAssetAdoptionStatus(this.selectedFeature);
      this._createAdoptActionContainer(assetStatus);
    },

    /**
    * Check whether the asset is already adopted or not
    * @memberOf widgets/Adopta/AssetDetails
    */
    _checkAssetAdoptionStatus: function (selectedFeature) {
      var relatedGUID, isAssetAdopted = false, isAssetAdoptedByLoggedInUser = false;
      relatedGUID = selectedFeature.attributes[this.map._layers[
        this.config.assetLayerDetails.id].relationships[0].keyField];
      if (relatedGUID && relatedGUID !== null && lang.trim(relatedGUID) !== "") {
        isAssetAdopted = true;
      }
      if (this.config.userDetails && isAssetAdopted && relatedGUID === this.config.userDetails[
      this.config.relatedTableDetails.keyField]) {
        isAssetAdoptedByLoggedInUser = true;
      }
      return {
        "isAssetAdopted": isAssetAdopted,
        "isAssetAdoptedByLoggedInUser": isAssetAdoptedByLoggedInUser
      };
    },

    /**
    * Create action container as per configuration
    * @param {object} selected assets status
    * @memberOf widgets/Adopta/AssetDetails
    */
    _createAdoptActionContainer: function (assetStatus) {
      var nicknameContainer, adoptBtnContainer, adoptBtn;
      domConstruct.empty(this.adoptActionContainer);
      //Hide textbox if asset is already adopted by other user
      if (!assetStatus.isAssetAdopted || assetStatus.isAssetAdoptedByLoggedInUser) {
        nicknameContainer = domConstruct.create("div", {
          "class": "esriCTFullWidth"
        }, this.adoptActionContainer);
        //TODO : create actions container
        this.nickNameInputTextBox = new TextBox({
          placeHolder: this.nls.nameAssetTextBoxPlaceholder
        });
        this.nickNameInputTextBox.placeAt(nicknameContainer);
      }
      adoptBtnContainer = domConstruct.create("div", {
        "class": "esriCTAdoptButtonContainer"
      }, this.adoptActionContainer);
      adoptBtn = domConstruct.create("div", {
        "class": "esriCTAdoptButton esriCTEllipsis jimu-btn"
      }, adoptBtnContainer);
      this._setAdoptButtonState(assetStatus, adoptBtn);
      //If actions container is already created remove it from the node
      domConstruct.empty(this.additionalActionContainer);
      if (assetStatus.isAssetAdoptedByLoggedInUser) {
        this._createActionButtons();
      }
      on(adoptBtn, "click", lang.hitch(this, function () {
        if (!domClass.contains(adoptBtn, "jimu-state-disabled")) {
          //Check if user is logged in and accordingly perform the actions
          if (this.config.userDetails) {
            //Check if nick name field is empty
            if (this.nickNameInputTextBox) {
              this.selectedFeature.attributes[this.config.nickNameField] = this.nickNameInputTextBox
                .getValue();
            }
            if (domAttr.get(adoptBtn, "innerHTML") === this.config.actions.assign.assignLabel) {
              this._adoptAsset(this.selectedFeature);
            } else {
              //as we are updateing only the nick name field send action as null
              this._updateFeatureDetails(this.selectedFeature, null, true);
            }
          } else {
            this.emit("adoptAsset", this.selectedFeature.attributes[this.layer.objectIdField]);
            this.showPanel("login");
          }
        }
      }));
    },

    /**
    * Set appropriate adopt button label
    * @param {object} selected assets status
    * @param {object} adopt button
    * @memberOf widgets/Adopta/AssetDetails
    */
    _setAdoptButtonState: function (assetStatus, adoptBtn) {
      var buttonText;
      if (assetStatus.isAssetAdopted && !assetStatus.isAssetAdoptedByLoggedInUser) {
        domClass.add(adoptBtn, "jimu-state-disabled");
        buttonText = this.config.actions.assign.assignedLabel;
      } else {
        if (assetStatus.isAssetAdoptedByLoggedInUser) {
          if (this.config.nickNameField !== "") {
            this.nickNameInputTextBox.set("value", this.selectedFeature.attributes[this.config
            .nickNameField]);
          }
          buttonText = this.nls.nickNameUpdateButtonLabel;
        } else {
          buttonText = this.config.actions.assign.assignLabel;
        }
      }
      domAttr.set(adoptBtn, "innerHTML", buttonText);
      domAttr.set(adoptBtn, "title", buttonText);
    },

    /**
    * emit name of panel that needs to be shown
    * @param {string} name panel to be shown
    * @memberOf widgets/Adopta/AssetDetails
    */
    showPanel: function (panel) {
      this.emit("showPanel", panel);
    },

    /**
    * This function initialize the Locator widget for reverse geocoding
    * @memberOf widgets/Adopta/AssetDetails
    */
    _initReverseGeocoder: function () {
      //By default if no geocoding service available in org then ArcGis online GeocodeServer will be used for reverse geocoding.
      var geocodeURL =
        "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      if (this.config.helperServices && this.config.helperServices.geocode &&
        this.config.helperServices.geocode[0] && this.config.helperServices
        .geocode[0].url) {
        geocodeURL = this.config.helperServices.geocode[0].url;
      }
      //create the locator instance to reverse geocode the address
      this._locatorInstance = new Locator(geocodeURL);
      this._locatorInstance.on("location-to-address-complete",
        lang.hitch(this, this._onLocationToAddressComplete));
      //Listen for error in locator
      this._locatorInstance.onError = lang.hitch(this, function (err) {
        this._onLocationToAddressFailed(err);
      });
    },

    /**
    * Callback handler called once location is reverse geocoded
    * @param {object} result of reverse geocoding
    * @memberOf widgets/Adopta/AssetDetails
    */
    _onLocationToAddressComplete: function (result) {
      //check if address available
      if (result.address && result.address.address) {
        this.locationAddress.innerHTML = result.address.address.Address;
      }
    },

    /**
    * Error back handler called once location is not reverse geocoded
    * @memberOf widgets/Adopta/AssetDetails
    */
    _onLocationToAddressFailed: function () {
      this.locationAddress.innerHTML = this.nls.streetAddressNotFoundText;
    },

    /**
    * Get selected asset's title
    * @param {object} current selected feature
    * @memberOf widgets/Adopta/AssetDetails
    */
    _getAssetTitle: function (selectedFeature) {
      var adoptedAssetString;
      if (lang.trim(selectedFeature.getTitle()) !== "") {
        adoptedAssetString = lang.trim(selectedFeature.getTitle());
      } else if (selectedFeature.attributes[this.layer.displayField]) {
        adoptedAssetString = selectedFeature.attributes[this.layer.displayField];
      } else {
        adoptedAssetString = "";
      }
      return adoptedAssetString;
    },

    /**
    * Function to adopt an selected asset
    * @param {object} current selected feature
    * @memberOf widgets/Adopta/AssetDetails
    */
    _adoptAsset: function (selectedFeature) {
      //Add users guid into asset to identify which asset belongs to user
      selectedFeature.attributes[this.config.assetLayerDetails.keyField] = this.config
        .userDetails[this.config.relatedTableDetails.keyField];
      this.updateFieldsForAction(this.config.actions.assign.name, selectedFeature, true);
    },

    /**
    * Update selected asset details
    * @param {object} current selected feature
    * @param {string} current action
    * @param {boolean} flag to decide the visibility of details panel
    * @memberOf widgets/Adopta/AssetDetails
    */
    _updateFeatureDetails: function (selectedFeature, actionName, showAssetDetails) {
      var isNewAssetAdopted,adoptionCompleteMsg;
      //if action is adoopted it means new asset is addopted
      if(actionName === this.config.actions.assign.name){
        isNewAssetAdopted = true;
      } else {
        isNewAssetAdopted = false;
      }
      this.loading.show();
      adoptionCompleteMsg = string.substitute(this.nls.adoptionCompleteMsg, {
        'assetTitle': this._getAssetTitle(selectedFeature)
      });
      this.layer.applyEdits(null, [selectedFeature], null, lang.hitch(this,
        function (added, updated, deleted) {
          /*jshint unused: false*/
          if (updated[0].success) {
            //Refresh layer and show the updated information in asset details panel
            this.layer.refresh();
            if (showAssetDetails) {
              this.showAssetInfoPopup(selectedFeature);
            }
            if (isNewAssetAdopted) {
              this.emit("showMessage", adoptionCompleteMsg);
              //If asset is adopted, increment the count of total number of adopted asset by logged in user
              this.emit("assetAdopted", selectedFeature.attributes[this.layer.objectIdField]);
            } else {
              this.emit("actionPerformed", actionName,
                selectedFeature.attributes[this.layer.objectIdField]);
              if (actionName === this.config.actions.unAssign.name) {
                this.emit("showMessage", string.substitute(this.nls.abandonCompleteMsg,
                  { assetTitle: this._getAssetTitle(selectedFeature), actionName: actionName }));
              }
            }
          } else {
            //Show error if adoption fails
            this.emit("showMessage", this.nls.unableToAdoptAssetMsg);
          }
          this.loading.hide();
        }), lang.hitch(this, function () {
          //Show error if adoption fails
          this.emit("showMessage", this.nls.unableToAdoptAssetMsg);
          this.loading.hide();
        }));
    },

    /**
    * Function to update the fields specified in actions
    * @param {string} current action
    * @param {object} current selected feature
    * @param {boolean} flag to decide the visibility of details panel
    * @memberOf widgets/Adopta/AssetDetails
    */
    updateFieldsForAction: function (actionName, selectedFeature, showAssetDetails) {
      var fieldsToUpdate;
      //check if action is unAssign choose its fields to update
      if (actionName === this.config.actions.unAssign.name) {
        selectedFeature.attributes[this.config.assetLayerDetails.keyField] = null;
        fieldsToUpdate = this.config.actions.unAssign.fieldsToUpdate;
      } else if (actionName === this.config.actions.assign.name) {
        //check if action is assign choose its fields to update and set adopt action flag
        fieldsToUpdate = this.config.actions.assign.fieldsToUpdate;
      }
      else {
        array.some(this.config.actions.additionalActions, lang.hitch(this,
          function (currentAction) {
            if (actionName === currentAction.name) {
              fieldsToUpdate = currentAction.fieldsToUpdate;
              return true;
            }
          }));
      }
      //set values in attributes as in configured action
      array.forEach(fieldsToUpdate, lang.hitch(this,
        function (currentAction) {
          switch (currentAction.action) {
          case "SetValue":
            selectedFeature.attributes[currentAction.field] = currentAction.value;
            break;
          case "SetDate":
            selectedFeature.attributes[currentAction.field] = Date.now();
            break;
          case "Clear":
            selectedFeature.attributes[currentAction.field] = null;
            break;
          }
        }));
      this._updateFeatureDetails(selectedFeature, actionName, showAssetDetails);
    },

    /**
    * Function to fetch selected asset through URL parameter
    * @param {string} selected asset id
    * @memberOf widgets/Adopta/AssetDetails
    */
    fetchSelectedAsset: function (assetId) {
      var queryField;
      queryField = new Query();
      queryField.where = this.layer.objectIdField + " = " + assetId;
      queryField.returnGeometry = true;
      queryField.outFields = ["*"];
      // Query for the features with the logged in UserId
      this.layer.queryFeatures(queryField, lang.hitch(this, function (
          response) {
        var assetAlreadyAdoptedMsg;
        if (response && response.features[0]) {
          //check if asset is already adopted
          if (this._checkAssetAdoptionStatus(response.features[0]).isAssetAdopted) {
            assetAlreadyAdoptedMsg = string.substitute(this.nls.assetAlreadyAdoptedMsg, {
              'assetTitle': this._getAssetTitle(response.features[0])
            });
            this.emit("showMessage", assetAlreadyAdoptedMsg);
          } else {
            this._adoptAsset(response.features[0]);
          }
          this.showAssetInfoPopup(response.features[0]);
          this.emit("highlightFeatureOnMap", this.selectedFeature);
        } else {
          //Show error if adoption fails
          this.emit("showMessage", this.nls.assetNotFoundMsg);
        }
      }));
    },

    /**
    * Function to create action button for selected assets based on configuration
    * @memberOf widgets/Adopta/AssetDetails
    */
    _createActionButtons: function () {
      var additionalActionsContainer;
      domConstruct.empty(this.additionalActionContainer);
      additionalActionsContainer = domConstruct.create("div", {}, this.additionalActionContainer);
      array.forEach(this.config.actions.additionalActions, lang.hitch(this,
        function (currentAction) {
          this._createBtn(currentAction, additionalActionsContainer);
        }));
      this._createBtn(this.config.actions.unAssign, additionalActionsContainer);
    },

    /**
    * Create action button
    * @param {string} current action
    * @param {string} parent node for action button
    * @memberOf widgets/Adopta/AssetDetails
    */
    _createBtn: function (currentAction, parentNode) {
      var actionBtn;
      actionBtn = domConstruct.create("div", {
        "class": "esriCTEllipsis jimu-btn esriCTStaticWidth",
        "innerHTML": currentAction.name,
        "title": currentAction.name
      }, parentNode);
      domAttr.set(actionBtn, "actionLabel", currentAction.name);
      on(actionBtn, "click", lang.hitch(this, function (evt) {
        this._fetchFieldsToBeUpdated(domAttr.get(evt.currentTarget, "actionLabel"));
      }));
    },

    /**
    * Obtained fields to be updated for particular action
    * @param {string} current action
    * @memberOf widgets/Adopta/AssetDetails
    */
    _fetchFieldsToBeUpdated: function (actionName) {
      this.updateFieldsForAction(actionName, this.selectedFeature, true);
    }
  });
});