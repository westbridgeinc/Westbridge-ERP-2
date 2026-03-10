# -*- coding: utf-8 -*-
"""
my_white_label: Theme app to override default logo, favicon, and login screen colors.
"""

from __future__ import unicode_literals

app_name = "my_white_label"
app_title = "My White Label"
app_publisher = "Your Company"
app_description = "Custom branding: logo, favicon, and login screen theme."
app_license = "MIT"

# Override default logo and favicon (Frappe theme app method)
# These paths are served from the app's public folder as /assets/my_white_label/...
app_logo_url = "/assets/my_white_label/images/logo.png"
favicon = "/assets/my_white_label/images/favicon.ico"

# Inject custom CSS on the login page for colors
app_include_css = [
    "my_white_label/css/login_theme.css",
]

# Optional: override app name shown in UI
# app_logo = "/assets/my_white_label/images/logo.png"

required_apps = []
