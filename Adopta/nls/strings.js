define({
  root: ({
    _widgetLabel: "Adopta", //Shown as widget title
    "loginSignUpLabel": "Login/Sign Up", //Shown as label to login button onLoad
    "signUpLabel": "Sign Up", //Shown as label to signup button
    "emailPlaceHolderText": "Enter email address (required)", //Shown as placeholder text in email input box
    "teamPlaceHolderText": "Team (optional)", //Shown as placeholder text in teamName input box
    "requiredText": "required",  //Shown as placeholder text in additional fields text box if the field is configured as 'required'
    "invalidConfigurationMessage": "Invalid Configuration", //Shown as message in widget panel if configuration is not valid
    "selectAssetToolTipBeforeLogin": "Click to select an asset", //Shown as tooltip when select location button is clicked
    "selectAssetToolTipAfterLogin": "Click to select/add an asset", //Shown as tooltip when select location button is clicked
    "streetAddressLabel": "Street Address", //Shown as title for reverse geocoded address section
    "streetAddressNotFoundText": "No address found", //Show in reverse geocoded address section if address is not found at selected location
    "nameAssetTextBoxPlaceholder": "Name your asset (optional)", //Shown as placeholder text in asset nickName input box
    "selectAssetMsg": "Please select an asset on map to adopt", //Shown as message in widget panel once user is logged in using the link sent to his email
    "gpServiceSuccessMsg": "The login link has been emailed to you. Please click the link in your email to access the application.", //Shown as message in widget panel once user signUp/logs in using email address
    "gpServiceLoginFailedMsg": "An error occurred while signing up. Please try after some time.", //Shown as message if any error occurs while signing up
    "invalidEmailMsg": "Please enter a valid email address.", //Shown as message if invalid email is entered
    "invalidFields": "Please make sure all the fields contain valid values and required fields are not empty.", //Shown as error message when all the required fields from additional fields are not entered
    "unableToAdoptAssetMsg": "Unable to adopt asset, please try again later.", //Shown as message if any error occurs while adopting an asset
    "nickNameUpdateButtonLabel": "Update", //Shown as label for nickName update button
    "adoptionCompleteMsg": "Thank you for adopting ${assetTitle}", //Shown as message in popup after asset is adopted
    "abandonCompleteMsg": "${assetTitle} successfully ${actionName}", //Shown as message in popup after asset is abondend
    "invalidAppLinkMsg": "Invalid Application link.", //Shown as message in popup if the invalid url parameters are passed
    "assetNotFoundMsg": "Asset not found.", //Shown as message in popup if the invalid url parameters are passed for adopting asset
    "assetAlreadyAdoptedMsg": "Asset ${assetTitle} is already adopted." //Shown as message in popup if the user is trying to adopt already adopted asset using url params
  }),
  "fr": 1
});
