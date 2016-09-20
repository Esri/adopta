///////////////////////////////////////////////////////////////////////////
// Copyright © 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'jimu/BaseWidget',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/text!./Login.html',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/Evented',
  'dojox/validate/web',
  'dijit/form/ValidationTextBox',
  'dojo/store/Memory',
  'dijit/form/ComboBox',
  'dojo/on',
  'dojo/Deferred',
  'dojo/query',
  'dojo/dom-construct',
  'dojo/dom-class',
  'dojo/dom-attr',
  'dojo/dom-style',
  'dojo/keys',
  'jimu/utils',
  'esri/tasks/Geoprocessor'
], function (
  declare,
  BaseWidget,
  _WidgetsInTemplateMixin,
  LoginTemplate,
  lang,
  array,
  Evented,
  validate,
  ValidationTextBox,
  Memory,
  ComboBox,
  on,
  Deferred,
  query,
  domConstruct,
  domClass,
  domAttr,
  domStyle,
  keys,
  jimuUtils,
  Geoprocessor
) {
  return declare([BaseWidget, Evented, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-Adopta-Login',
    templateString: LoginTemplate, //set template string
    userDetails: {}, //object to hold user info like userId, email etc
    userTableLayer: null,
    _teamFieldComboBox: null,
    urlParamsToBeAdded: {}, //Parameters to be added in url which will be sent via email
    constructor: function (options) {
      lang.mixin(this, options);
    },

    startup: function () {
      this._init();
    },
    postCreate: function () {
      this.inherited(arguments);
    },

    /**
    * Creates & init all the required controls for login.
    * @memberOf widgets/Adopta/Login
    **/
    _init: function () {
      this._authGPService = new Geoprocessor(this.config.authGPServiceURL);

      domClass.add(this.domNode, "esriCTFullHeight");
      this.emailTextbox = new ValidationTextBox({
        validator: validate.isEmailAddress,
        placeHolder: this.nls.emailPlaceHolderText,
        isRequired: true,
        maxlength: 100 //set max length for email field as 100
      });
      this.emailTextbox.placeAt(this.emailContainer);
      this.own(on(this.emailTextbox, "keypress", lang.hitch(this, function (evt) {
        var charOrCode = evt.charCode || evt.keyCode;
        //Check for ENTER key
        if (charOrCode === keys.ENTER) {
          this._loginBtnClicked();
        }
      })));
      this.own(on(this.loginBtn, "click", lang.hitch(this, this._loginBtnClicked)));

      //Create additional fields if configured
      if (this.config.additionalLoginParameters.length > 0) {
        //Create controls for additional fields
        this._createAdditionalFields();
      }

      //SanitizeHTML before setting innerHTML
      this.loginInfoContainer.innerHTML = this.config.loginHelpText;
      //Check for url params
      if (this.config.urlParams && this.config.urlParams.userid &&
        this.config.urlParams.usertoken) {
        //check if user exist using userid from url so pass param as true
        this._checkIfUserExist(true);
      }

      //set height of login info container
      this.calculateHight();

      //Listen for registeredUserLink click event
      on(this.registeredUserLink, "click", lang.hitch(this, function () {
        this._resetLoginPanel();
        this.calculateHight();
      }));
    },

    /**
    * Reset login panel by hiding all the other additional sign up fields
    * @memberOf widgets/Adopta/Login
    **/
    _resetLoginPanel: function () {
      domClass.add(this.additionalFieldsContainer, "esriCTHidden");
      domClass.add(this.registeredUserLink, "esriCTHidden");
      domAttr.set(this.loginBtn, "innerHTML", this.nls.loginSignUpLabel);
      //Reset additional fields
      array.forEach(this.config.additionalLoginParameters,
        lang.hitch(this, function (currentField) {
          currentField.control.set("value", "");
        }));
    },

    /**
    * Remove all the app parameters from URL before sending it to GP service
    * @memberOf widgets/Adopta/Login
    **/
    _getAppURL: function () {
      var appURL;
      appURL = window.location.href;
      //TODO: check an alternative to load app in builder mode and support the mode parameter
      appURL = jimuUtils.url.removeQueryParamFromUrl(appURL, "mode");
      appURL = jimuUtils.url.removeQueryParamFromUrl(appURL, "userid");
      appURL = jimuUtils.url.removeQueryParamFromUrl(appURL, "usertoken");
      //Remove parameter for fixed actions(adopt and abandon)
      appURL = jimuUtils.url.removeQueryParamFromUrl(appURL,
        this.config.actions.assign.urlParameterLabel);
      appURL = jimuUtils.url.removeQueryParamFromUrl(appURL,
        this.config.actions.unAssign.urlParameterLabel);
      //Remove parameters for configured actions if available
      array.forEach(this.config.actions.additionalActions, lang.hitch(this,
        function (currentAction) {
          appURL = jimuUtils.url.removeQueryParamFromUrl(appURL, currentAction.urlParameterLabel);
        }));
      return appURL;
    },

    /**
    * Creates configuration required for gptool
    * @memberOf widgets/Adopta/Login
    **/
    _getRequiredConfigForGPTool: function () {
      var widgetConfig = {};
      widgetConfig.actions = this.config.actions;
      widgetConfig.nickNameField = this.config.nickNameField;
      widgetConfig.foreignKeyFieldForUserTable = this.config.foreignKeyFieldForUserTable;
      return JSON.stringify(widgetConfig);
    },

    /**
    * Creates & init all the required controls for login.
    * @memberOf widgets/Adopta/Login
    **/
    _checkIfUserExist: function (usingUserID) {
      var params, appURL, popupTitle = "";
      this.emit("userAuth");
      appURL = this._getAppURL();
      if (this.layer.infoTemplate &&
        this.layer.infoTemplate.info &&
        this.layer.infoTemplate.info.title) {
        popupTitle = this.layer.infoTemplate.info.title;
      }
      this.loading.show();
      if (usingUserID) {
        params = {
          "Userid": this.config.urlParams.userid,
          "Usertoken": this.config.urlParams.usertoken,
          "Action": "validate",
          "App_URL": appURL,
          "Asset_popup_configuration": popupTitle,
          "Widget_configuration": this._getRequiredConfigForGPTool()
        };
      } else {
        params = {
          "Input_user_email": this.userDetails[this.config.emailField],
          "Action": "login",
          "App_URL": appURL,
          "Asset_popup_configuration": popupTitle,
          "Widget_configuration": this._getRequiredConfigForGPTool()
        };
        if (this.urlParamsToBeAdded.hasOwnProperty(this.config.actions.assign.urlParameterLabel)) {
          params.Adopted_assetid = this.urlParamsToBeAdded[
            this.config.actions.assign.urlParameterLabel];
        }
      }
      this._authGPService.execute(params, lang.hitch(this, function (
          response) {
        if (response && response.length > 0 && response[0].value && response[0]
          .value.status.toLowerCase() === "success") {
          if (usingUserID) {
            if (response[0].value && typeof (response[0].value.description) === "string" &&
              response[0].value.description.toLowerCase() === "regenerated usertoken") {
              this.showMsg(this.config.userTokenExpiredMsg);
              this.emit("invalidLogin");
            } else {
              this.userDetails[this.config.foreignKeyFieldForUserTable] =
                this.config.urlParams.userid;
              if (response[0].value.description && response[0].value.description.email) {
                this.userDetails[this.config.emailField] = response[0].value.description.email;
              }
              this.loggedIn(this.userDetails);
            }
          } else {
            this.showMsg(this.config.gpServiceSuccessMsg);
            this.emit("invalidLogin");
          }
          this.loading.hide();
        } else {
          if (!usingUserID) {
            if (response && response.length > 0 && response[0].value &&
              response[0].value.status.toLowerCase() === "failed" &&
              typeof(response[0].value.description) === "string" &&
              response[0].value.description.toLowerCase() ===
              "user does not exist") {
              domAttr.set(this.loginBtn, "innerHTML", this.nls.signUpLabel);
              //If teamfield is not configured or additional fields are not configured then
              //directly call signup
              //Get unique team names for team auto complete box
              this._getUniqueTeamNames().then(lang.hitch(this, function () {
                if (!this.config.teamField &&
                  this.config.additionalLoginParameters.length === 0) {
                  this._loginBtnClicked();
                } else {
                  domClass.remove(this.additionalFieldsContainer, "esriCTHidden");
                  //Show link to navigate back to basic login form
                  domClass.remove(this.registeredUserLink, "esriCTHidden");
                  //set height of login info container
                  this.calculateHight();
                  this.loading.hide();
                  //Since user again goes on login page, connect map event handler
                  this.emit("registeredUserCallback");
                }
              }));
            } else {
              if (response && response.length > 0) {
                this.showMsg(response[0].value.description);
              } else {
                this.showMsg(this.nls.noOutputParameterMsg);
              }
              this.emit("invalidLogin");
              this.loading.hide();
            }
          } else {
            if (response && response.length > 0) {
              this.showMsg(response[0].value.description);
            } else {
              this.showMsg(this.nls.noOutputParameterMsg);
            }
            this.emit("invalidLogin");
            this.loading.hide();
          }
        }
      }), lang.hitch(this, function (err) {
        this.loading.hide();
        this.showMsg(err.message);
        this.emit("invalidLogin");
      }));
    },

    /**
    * Creates controls for additional configured fields.
    * @memberOf widgets/Adopta/Login
    **/
    _createAdditionalFields: function () {
      var i;
      for (i = 0; i < this.config.additionalLoginParameters.length; i++) {
        this._createFieldInputs(
          this.additionalFieldsContainer,
          this.config.additionalLoginParameters[i]);
      }
    },

    /**
    * Creates Textbox.
    * @memberOf widgets/Adopta/Login
    **/
    _createFieldInputs: function (nodeContainer, fieldDetails) {
      var inputTextBox;
      inputTextBox = new ValidationTextBox({
        placeHolder: fieldDetails.placeHolderText,
        required: fieldDetails.required,
        maxlength: fieldDetails.length
      });
      if (fieldDetails.required) {
        inputTextBox.set("placeHolder", inputTextBox.placeHolder +
          " (" + this.nls.common.required + ")");
      }
      inputTextBox.placeAt(nodeContainer);
      fieldDetails.control = inputTextBox;
    },

    /**
    * Callback handler executed once login/signup button is clicked
    * @memberOf widgets/Adopta/Login
    **/
    _loginBtnClicked: function () {
      //Focus out from the email textbox
      if (this.emailTextbox.focusNode) {
        this.emailTextbox.focusNode.blur();
      }
      if (this.emailTextbox.isValid()) {
        this.userDetails[this.config.emailField] = this.emailTextbox.get("value");
        if (lang.trim(domAttr.get(this.loginBtn, "innerHTML")) === this.nls.signUpLabel) {
          if (this._validateFields()) {
            this._registerUser();
          } else {
            this.showMsg(this.nls.invalidFields);
          }
        } else {
          //check if user exist using email id so pass param as false
          this._checkIfUserExist(false);
        }
      } else {
        this.showMsg(this.nls.invalidEmailMsg);
      }
    },

    /**
    * Validate field values
    * @memberOf widgets/Adopta/Login
    **/
    _validateFields: function () {
      var isValidData = true;
      array.some(this.config.additionalLoginParameters, lang.hitch(this, function (currentField) {
        if (!currentField.control.isValid()) {
          isValidData = false;
          return true;
        }
      }));
      return isValidData;
    },

    /**
    * Register user and add new entry in table
    * @memberOf widgets/Adopta/Login
    **/
    _registerUser: function () {
      var attributes, params = {}, key;
      this.loading.show();
      // create an empty array object
      attributes = {};
      if (this._teamFieldComboBox) {
        attributes[this.config.teamField.name] = this._teamFieldComboBox.get("value");
      }
      array.forEach(this.config.additionalLoginParameters, lang.hitch(this,
        function (currentField) {
          // get id of the field
          key = currentField.field;
          // Assign value to the attributes
          attributes[key] = currentField.control.get("value");
        }));

      params = {
        "Input_user_email": this.emailTextbox.get("value"),
        "Signup_fields": JSON.stringify(attributes),
        "App_URL": this._getAppURL(),
        "Action": "signup"
      };
      if (this.urlParamsToBeAdded.hasOwnProperty(this.config.actions.assign.urlParameterLabel)) {
        params.Adopted_assetid = this.urlParamsToBeAdded[
          this.config.actions.assign.urlParameterLabel];
      }
      this._authGPService.execute(params, lang.hitch(this, function (
      response) {
        if (response && response.length > 0 &&
          response[0].value.status.toLowerCase() === "success") {
          this.showMsg(this.config.gpServiceSuccessMsg);
          this._resetLoginPanel();
          this.loading.hide();
        } else {
          if (response && response.length > 0) {
            this.showMsg(response[0].value.description);
          } else {
            this.showMsg(this.nls.noOutputParameterMsg);
          }
          this.loading.hide();
        }
        this.emit("registeredUserCallback");
      }), function (err) {
        this.showMsg(err.message);
        this.loading.hide();
        this.emit("registeredUserCallback");
      });
    },

    /**
    * Gets all the unique team names from related table and creates team auto complete box.
    * @memberOf widgets/Adopta/Login
    **/
    _getUniqueTeamNames: function () {
      var params, deferred = new Deferred();
      params = {
        "Action": "Teams"
      };

      this._authGPService.execute(params, lang.hitch(this, function (
          response) {
        var selectedUniqueValues = [];
        if (response && response.length > 0 &&
          response[0].value.status.toLowerCase() === "success" &&
          response[0].value.description &&
          response[0].value.description.teamfield &&
          response[0].value.description.teamfield.hasOwnProperty("name")) {
          this.config.teamField = response[0].value.description.teamfield;
          //push selected attributes value of all the features into an array
          array.forEach(response[0].value.description.features, lang.hitch(this,
            function (feature) {
              selectedUniqueValues.push({ "name": feature.attributes[this.config.teamField.name] });
            }));
          this._createTeamAutoCompleteBox(selectedUniqueValues);
        }
        deferred.resolve();
      }));
      return deferred.promise;
    },

    /**
    * Creates team auto complete box.
    * @memberOf widgets/Adopta/Login
    **/
    _createTeamAutoCompleteBox: function (selectedUniqueValues) {
      var teamNamesStore;
      domConstruct.empty(this.teamContainer);
      teamNamesStore = new Memory({
        data: selectedUniqueValues
      });
      this._teamFieldComboBox = new ComboBox({
        name: "teamName",
        value: "",
        store: teamNamesStore,
        searchAttr: "name",
        placeHolder: this.nls.teamPlaceHolderText,
        maxlength: this.config.teamField.length
      });
      this._teamFieldComboBox.placeAt(this.teamContainer);
    },

    /**
    * Add URL parameters to application link
    * @memberOf widgets/Adopta/Login
    **/
    addURLParams: function (key, value) {
      this.urlParamsToBeAdded[key] = value;
    },

    /**
    * Calculate hegiht for login info container
    * @memberOf widgets/Adopta/Login
    **/
    calculateHight: function () {
      var fixedHeight;
      fixedHeight = query(".esriCTLoginSection")[0].clientHeight - this.loginDetailsContainer
        .clientHeight;
      domStyle.set(this.loginInfoContainer, "height", fixedHeight - 40 + "px");
    },

    /* ----------------------- */
    /* Event handler functions */
    /* ----------------------- */

    showMsg: function (msgString) {
      this.emit("showMessage", msgString);
    },

    loggedIn: function (userDetails) {
      this.emit("loggedIn", userDetails);
    }
  });
});