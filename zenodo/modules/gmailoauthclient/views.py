  #
  # Copyright 2020 INGV - OE (Catania, Italy)
  #
  # Licensed under the Apache License, Version 2.0 (the "License");
  # you may not use this file except in compliance with the License.
  # You may obtain a copy of the License at
  #
  #   http://www.apache.org/licenses/LICENSE-2.0
  #
  # Unless required by applicable law or agreed to in writing, software
  # distributed under the License is distributed on an "AS IS" BASIS,
  # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  # See the License for the specific language governing permissions and
  # limitations under the License.


__author__ = 'fabrizio, mario'

import requests
import json
from datetime import datetime
from flask import Blueprint, current_app, redirect, request
from flask_security import login_user
from flask_security.registerable import register_user
from invenio_accounts.models import User
from random import choice
from string import ascii_lowercase, ascii_uppercase, digits
from sqlalchemy import func
from werkzeug.local import LocalProxy
from oauthlib.oauth2 import WebApplicationClient

_security = LocalProxy(lambda: current_app.extensions['security'])
_datastore = LocalProxy(lambda: _security.datastore)
_clientId = LocalProxy(lambda: current_app.config.get('GOOGLE_CLIENT_ID'))
_clientSecret = LocalProxy(lambda: current_app.config.get('GOOGLE_CLIENT_SECRET'))
client = WebApplicationClient(_clientId)

blueprint = Blueprint(
    'zenodo_gmailoauthclient',
    __name__,
    url_prefix='/oauth'
)

@blueprint.route('login/callback')
def callback():
    # Get authorization code Google sent back to you
    code = request.args.get("code")
    current_app.logger.debug('CODE IS: %s' %code)

    # Find out what URL to hit to get tokens that allow you to ask for
    # things on behalf of a user
    google_provider_cfg = get_google_provider_cfg()
    token_endpoint = google_provider_cfg["token_endpoint"]

    # Prepare and send a request to get tokens! Yay tokens!
    token_url, headers, body = client.prepare_token_request(
        token_endpoint,
        authorization_response=request.url,
        redirect_url=request.base_url,
        code=code
    )
    token_response = requests.post(
        token_url,
        headers=headers,
        data=body,
        auth=(_clientId, _clientSecret)
    )

    # Parse the tokens!
    client.parse_request_body_response(json.dumps(token_response.json()))

    # Now that you have tokens (yay) let's find and hit the URL
    # from Google that gives you the user's profile information,
    # including their Google profile image and email
    userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
    current_app.logger.debug('USR_NFO_EPT: %s' %userinfo_endpoint)
    uri, headers, body = client.add_token(userinfo_endpoint)
    userinfo_response = requests.get(uri, headers=headers, data=body)

    # You want to make sure their email is verified.
    # The user authenticated with Google, authorized your
    # app, and now you've verified their email through Google!

    if userinfo_response.json().get("email_verified"):
        unique_id = userinfo_response.json()["sub"]
        users_email = userinfo_response.json()["email"]
        picture = userinfo_response.json()["picture"]
        users_name = userinfo_response.json()["given_name"]

        if users_email is not None:
            user = User.query.filter(func.lower(User.email) == func.lower(users_email)).one_or_none()
            if user is None:
                password = ''.join(choice(ascii_uppercase + ascii_lowercase + digits) for _ in range(16))
                user = register_user(password=password, email=users_email.lower(), active=True, confirmed_at=datetime.now())

            login_user(user, remember=False)

    else:
        return "User email not available or not verified by Google.", 400

    return redirect('/')

@blueprint.route('/login')
def login():
    current_app.logger.debug('Try to authenticate with app PDZ: %s' %_clientId)

    # Find out what URL to hit for Google login
    google_provider_cfg = get_google_provider_cfg()
    authorization_endpoint = google_provider_cfg["authorization_endpoint"]

    request_uri = client.prepare_request_uri(
        authorization_endpoint,
        redirect_uri=request.base_url + "/callback",
        scope=["openid", "email", "profile"],
    )
    return redirect(request_uri)

def get_google_provider_cfg():
    return requests.get(current_app.config.get('GOOGLE_DISCOVERY_URL')).json()
