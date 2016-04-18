define([
  'dojo/_base/declare',
  'jimu/BaseWidget',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/text!./Login.html',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/Evented',
  'esri/tasks/query',
  'esri/tasks/QueryTask',
  'esri/graphic',
  'esri/layers/FeatureLayer',
  'dojox/validate/web',
  'dijit/form/ValidationTextBox',
  'dojo/store/Memory',
  'dijit/form/ComboBox',
  'dojo/on',
  'dojo/dom-class',
  'dojo/dom-attr',
  'dojo/keys'
], function (
  declare,
  BaseWidget,
  _WidgetsInTemplateMixin,
  LoginTemplate,
  lang,
  array,
  Evented,
  Query,
  QueryTask,
  Graphic,
  FeatureLayer,
  validate,
  ValidationTextBox,
  Memory,
  ComboBox,
  on,
  domClass,
  domAttr,
  keys
) {
  return declare([BaseWidget, Evented, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-Adopta-Login',
    templateString: LoginTemplate, //set template string
    userDetails: {}, //objet to hold user info like userId, email etc
    _teamFieldComboBox: null,
    constructor: function (options) {
      lang.mixin(this, options);
    },

    postCreate: function () {
      this.inherited(arguments);
      this._init();
    },

    /**
    * Creates & init all the required controls for login.
    * @memberOf widgets/Adopta/Login
    **/
    _init: function () {
      domClass.add(this.domNode, "esriCTFullHeight");
      this.emailTextbox = new ValidationTextBox({
        validator: validate.isEmailAddress,
        placeHolder: this.nls.emailPlaceHolderText,
        isRequired: true
      });
      this.emailTextbox.placeAt(this.emailContainer);
      on(this.emailTextbox, "keypress", lang.hitch(this, function (evt) {
        var charOrCode = evt.charCode || evt.keyCode;
        //Check for ENTER key
        if (charOrCode === keys.ENTER) {
          this._loginBtnClicked();
        }
      }));
      on(this.loginBtn, "click", lang.hitch(this, this._loginBtnClicked));

      //Fetch distinct values and create team field only if it is configured
      if (this.config.teamField !== "") {
        //get unique team names for team auto complete box
        this._getUniqueTeamNames();
      }

      //Create additional fields if configured
      if (this.config.additionalFields.length > 0) {
        //Create controls for additional fields
        this._createAdditionalFields();
      }

      //TODO: use sanitizeHTML before setting innerHTML
      this.loginInfoContainer.innerHTML = this.config.loginHelpText;
      this.relatedTable = new FeatureLayer(this.config.relatedTableDetails.url);
      on(this.relatedTable, "load", lang.hitch(this, function () {
        array.some(this.relatedTable.relationships, lang.hitch(this,
          function (currentRelationship) {
          if (currentRelationship.id === this.config.relatedTableDetails.relationShipId) {
            this.config.relatedTableDetails.keyField = currentRelationship.keyField;
            return true;
          }
        }));
        //check for url params
        if (this.config.urlParams && this.config.urlParams.userid) {
          //check if user exist using userid from url so pass param as true
          this._checkIfUserExist(true);
        }
      }));
    },

    /**
    * Creates & init all the required controls for login.
    * @memberOf widgets/Adopta/Login
    **/
    _checkIfUserExist: function (usingUserID) {
      var queryTaskValue, queryField, whereCondition;
      this.loading.show();
      queryTaskValue = new QueryTask(this.config.relatedTableDetails.url);
      queryField = new Query();
      if (usingUserID) {
        whereCondition = this.config.relatedTableDetails.keyField + " = '" +
          this.config.urlParams.userid + "'";
      } else {
        whereCondition = this.config.emailField + " = '" +
          this.userDetails[this.config.emailField] + "'";
      }
      queryField.where = whereCondition;
      queryField.returnGeometry = false;
      queryField.outFields = ["*"];
      queryTaskValue.execute(queryField, lang.hitch(this, function (
          response) {
        this.loading.hide();
        if (response.features && response.features.length > 0) {
          this.userDetails = lang.clone(response.features[0].attributes);
          if (usingUserID) {
            this.loggedIn(this.userDetails);
          } else {
            this.signUpSuccessfull(this.userDetails);
          }
        } else {
          if (!usingUserID) {
            domAttr.set(this.loginBtn, "innerHTML", this.nls.signUpLabel);
            //Check if team field and additional fields are configured and open the respective input controls
            if (this.config.teamField === "" && this.config.additionalFields.length === 0) {
              this._loginBtnClicked();
            } else {
              domClass.remove(this.additionalFieldsContainer, "esriCTHidden");
              domClass.add(this.loginInfoContainer, "esriCTMinimizeLoginInfoContainer");
            }
          } else {
            this.showMsg(this.nls.invalidAppLinkMsg);
            this.emit("invalidLogin");
          }
        }
      }), lang.hitch(this, function () {
        this.loading.hide();
        this.showMsg(this.nls.invalidAppLinkMsg);
        this.emit("invalidLogin");
      }));
    },

    /**
    * Creates controls for additional configured fields.
    * @memberOf widgets/Adopta/Login
    **/
    _createAdditionalFields: function () {
      var i;
      for (i = 0; i < this.config.additionalFields.length; i++) {
        this._createFieldInputs(this.additionalFieldsContainer, this.config.additionalFields[i]);
      }
    },

    /**
    * Creates Textbox.
    * @memberOf widgets/Adopta/Login
    **/
    _createFieldInputs: function (nodeContainer, fieldDetails) {
      var inputTextBox = new ValidationTextBox({
        placeHolder: fieldDetails.placeHolderText,
        required: fieldDetails.isRequired
      });
      if (fieldDetails.isRequired) {
        inputTextBox.set("placeHolder", inputTextBox.placeHolder +
          " (" + this.nls.requiredText + ")");
      }
      inputTextBox.placeAt(nodeContainer);
      fieldDetails.control = inputTextBox;
    },

    /**
    * Callback handler executed once login/signup button is clicked
    * @memberOf widgets/Adopta/Login
    **/
    _loginBtnClicked: function () {
      if (this.emailTextbox.isValid()) {
        this.userDetails[this.config.emailField] = this.emailTextbox.getValue();
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
      array.some(this.config.additionalFields, lang.hitch(this, function (currentField) {
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
      var userData, key;
      this.loading.show();
      // Create instance of graphic
      userData = new Graphic();
      // create an empty array object
      userData.attributes = {};
      userData.attributes[this.config.emailField] = this.emailTextbox.getValue();
      if (this._teamFieldComboBox) {
        userData.attributes[this.config.teamField] = this._teamFieldComboBox.getValue();
      }
      array.forEach(this.config.additionalFields, lang.hitch(this, function (currentField) {
        // get id of the field
        key = currentField.field;
        // Assign value to the attributes
        userData.attributes[key] = currentField.control.getValue();
      }));

      // Add the comment to the comment table
      this.relatedTable.applyEdits([userData], null, null, lang.hitch(this, function (results) {
        if (results[0].success) {
          this._updateUserDetails(results[0].objectId);
        } else {
          this.loading.hide();
        }
      }), lang.hitch(this, function () {
        this.loading.hide();
      }));
    },

    /**
    * Update user details based on the features attributes
    * @memberOf widgets/Adopta/Login
    **/
    _updateUserDetails: function (objectId) {
      var queryTaskValue, queryField;
      queryTaskValue = new QueryTask(this.config.relatedTableDetails.url);
      queryField = new Query();
      queryField.objectIds = [objectId];
      queryField.returnGeometry = false;
      queryField.outFields = ["*"];
      queryTaskValue.execute(queryField, lang.hitch(this, function (
          response) {
        this.loading.hide();
        if (response.features && response.features.length > 0) {
          this.userDetails = lang.clone(response.features[0].attributes);
          this.signUpSuccessfull(this.userDetails);
        }
      }));
    },

    /**
    * Gets all the unique team names from related table and creates team auto complete box.
    * @memberOf widgets/Adopta/Login
    **/
    _getUniqueTeamNames: function () {
      var queryTaskValue, queryField;
      queryTaskValue = new QueryTask(this.config.relatedTableDetails.url);
      queryField = new Query();
      queryField.where = "1=1";
      queryField.returnDistinctValues = true;
      queryField.returnGeometry = false;
      queryField.outFields = [this.config.teamField];
      queryTaskValue.execute(queryField, lang.hitch(this, function (
          response) {
        var selectedUniqueValues = [];
        //push selected attributes's value of all the features into an array
        array.forEach(response.features, lang.hitch(this, function (feature) {
          selectedUniqueValues.push({ "name": feature.attributes[this.config.teamField] });
        }));
        this._createTeamAutoCompleteBox(selectedUniqueValues);
      }));
    },

    /**
    * Creates team auto complete box.
    * @memberOf widgets/Adopta/Login
    **/
    _createTeamAutoCompleteBox: function (selectedUniqueValues) {
      var teamNamesStore = new Memory({
        data: selectedUniqueValues
      });
      this._teamFieldComboBox = new ComboBox({
        name: "teamName",
        value: "",
        store: teamNamesStore,
        searchAttr: "name",
        placeHolder: this.nls.teamPlaceHolderText
      });
      this._teamFieldComboBox.placeAt(this.teamContainer);
    },

    /* ----------------------- */
    /* Event handler functions */
    /* ----------------------- */

    showMsg: function (msgString) {
      this.emit("showMessage", msgString);
    },

    loggedIn: function (userDetails) {
      this.emit("loggedIn", userDetails);
    },

    signUpSuccessfull: function (userDetails) {
      this.emit("signedIn", userDetails);
    }

  });
});