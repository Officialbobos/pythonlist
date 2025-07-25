from dotenv import load_dotenv
load_dotenv() # Load environment variables from .env file

import os
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from datetime import datetime
from functools import wraps
import bcrypt
from pymongo import MongoClient
from bson.objectid import ObjectId
import json

from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash, send_from_directory
from werkzeug.utils import secure_filename

# Logging setup
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
app_logger = logging.getLogger(__name__)
app_logger.setLevel(logging.INFO)

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', '11a0379440d11cbf1da4a0bd8d81aee8e278fcfb9d8a9f5f')

# MongoDB setup
MONGO_URI = os.getenv('MONGO_URI')
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME')

if not MONGO_URI or not MONGO_DB_NAME:
    app_logger.error("MongoDB URI or DB Name not set in .env. Exiting.")
    exit(1)

client = MongoClient(MONGO_URI)
db = client.get_database(MONGO_DB_NAME)
applications_collection = db.applications
admin_collection = db.admin
winners_collection = db.winners

# Email Configuration
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
ADMIN_RECEIVING_EMAIL = os.getenv("ADMIN_RECEIVING_EMAIL")

if not all([EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD, ADMIN_RECEIVING_EMAIL]):
    app_logger.warning("One or more email environment variables (EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD, ADMIN_RECEIVING_EMAIL) are not set. Email functionality may not work.")

# Upload folder configuration
UPLOAD_FOLDER = 'static/uploads' # For winner images
ID_CARD_UPLOAD_FOLDER = 'static/id_uploads' # For application ID cards

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['ID_CARD_UPLOAD_FOLDER'] = ID_CARD_UPLOAD_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(ID_CARD_UPLOAD_FOLDER, exist_ok=True)

# Allowed image extensions for winner image uploads
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Allowed extensions for ID card uploads (images and PDF)
ALLOWED_ID_CARD_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}

def allowed_file(filename, allowed_extensions):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions

# --- Helper Function for Sending Email ---
def send_email(subject, body, to_email, html=True, sender_name="The Global Fund"):
    msg = MIMEMultipart("alternative")
    msg["From"] = Header(f"{sender_name} <{EMAIL_USERNAME}>", 'utf-8')
    msg["To"] = to_email
    msg["Subject"] = subject

    if html:
        part = MIMEText(body, "html")
    else:
        part = MIMEText(body, "plain")
    
    msg.attach(part)

    try:
        if EMAIL_PORT == 465:
            with smtplib.SMTP_SSL(EMAIL_HOST, EMAIL_PORT) as server:
                server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
                server.starttls()
                server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
                server.send_message(msg)
        app_logger.info(f"Email sent successfully to {to_email} with subject: {subject}")
        return True
    except Exception as e:
        app_logger.error(f"Error sending email to {to_email} (Subject: {subject}): {e}")
        return False

# --- Decorators ---
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            if request.path.startswith('/api/'):
                return jsonify({'message': 'Unauthorized access.'}), 403
            flash('You need to be logged in to access this page.', 'danger')
            return redirect(url_for('admin_login_page'))
        return f(*args, **kwargs)
    return decorated_function

# --- Routes for Admin Panel UI (returning HTML fragments) ---

@app.route('/dashboard', methods=['GET'])
@admin_required
def dashboard():
    return render_template('dashboard.html', admin_username=session.get('admin_username'))

@app.route('/view_applications_content', methods=['GET'])
@admin_required
def view_applications_content():
    applications = list(applications_collection.find().sort("submission_date", -1))
    return render_template('view_applications_content.html', applications=applications)

@app.route('/admin/applications/<application_id>/view', methods=['GET'])
@admin_required
def view_application_details_content(application_id):
    try:
        application = applications_collection.find_one({"_id": ObjectId(application_id)})
        if not application:
            return "<p class='text-red-500'>Application not found.</p>", 404
        return render_template('application_details_content.html', application=application)
    except Exception as e:
        app_logger.error(f"Error viewing application details for {application_id}: {e}")
        return "<p class='text-red-500'>Error loading application details.</p>", 500

@app.route('/view_winners_content', methods=['GET'])
@admin_required
def view_winners_content():
    winners = list(winners_collection.find().sort("created_at", -1))
    return render_template('view_winners_content.html', winners=winners)

@app.route('/winner_form_content', methods=['GET'])
@admin_required
def winner_form_content():
    winner_id = request.args.get('id')
    winner = None
    if winner_id:
        try:
            object_id = ObjectId(winner_id)
            winner = winners_collection.find_one({"_id": object_id})
            if not winner:
                flash('Winner not found.', 'warning')
                return redirect(url_for('view_winners_content'))
        except Exception as e:
            app_logger.error(f"Invalid winner ID for form: {winner_id} - {e}")
            flash('Invalid winner ID format.', 'danger')
            return redirect(url_for('view_winners_content'))

    return render_template('winner_form_content.html', winner=winner)

@app.route('/view_users_content_admin', methods=['GET'])
@admin_required
def view_users_content_admin():
    users = list(applications_collection.find())
    return render_template('view_users_content_admin.html', users=users)

# --- Public Facing Routes (Home, About, Contact, Application Form) ---

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/eligibility')
def eligibility():
    return render_template('eligibility.html')

@app.route('/how-to-apply')
def how_to_apply():
    return render_template('how_to_apply.html')

@app.route('/application')
def application_form():
    return render_template('application_form.html')

@app.route('/privacy-policy')
def privacy_policy():
    return render_template('privacy_policy.html')

@app.route('/terms-of-service')
def terms_of_service():
    return render_template('terms_of_service.html')

@app.route('/winners')
def winners_public():
    all_winners = list(winners_collection.find({}).sort("created_at", -1))
    return render_template('winners_public.html', winners=all_winners)

@app.route('/form.html')
def form_page():
    return render_template('form.html')

@app.route('/login.html')
def login_page():
    return render_template('login.html')

# --- Admin Login/Logout ---

@app.route('/admin_login', methods=['GET'])
def admin_login_page():
    if session.get('admin_logged_in'):
        return redirect(url_for('dashboard'))
    return render_template('admin_login.html')

@app.route('/logout', methods=['GET', 'POST'])
def logout():
    session.pop('admin_logged_in', None)
    session.pop('admin_username', None)
    flash('You have been logged out.', 'info')
    return redirect(url_for('admin_login_page'))

# --- API Endpoints for CRUD Operations and Login ---

# ADMIN API: Get all winners for the admin dashboard
@app.route('/api/admin/winners', methods=['GET'])
@admin_required
def get_admin_winners_api():
    try:
        winners_cursor = winners_collection.find().sort("created_at", -1)
        serialized_winners = []
        for winner in winners_cursor:
            winner_data = dict(winner)
            winner_data['_id'] = str(winner_data['_id'])
            winner_data['amount'] = float(winner_data.get('amount', 0.0))
            winner_data['payment_fee'] = float(winner_data.get('payment_fee', 0.0))
            if winner_data.get('image_path'):
                winner_data['image_url'] = url_for('static', filename=f"uploads/{winner_data['image_path']}")
            else:
                winner_data['image_url'] = url_for('static', filename='images/placeholder.png')
            serialized_winners.append(winner_data)

        return jsonify({'success': True, 'winners': serialized_winners}), 200
    except Exception as e:
        app_logger.error(f"Error fetching admin winners API: {e}")
        return jsonify({'success': False, 'message': 'Failed to retrieve admin winner data.'}), 500

# PUBLIC API: Get all winners for the public facing table
@app.route('/api/public/winners', methods=['GET'])
def get_public_winners_api():
    try:
        all_winners = list(winners_collection.find({}).sort("created_at", -1))

        serialized_winners = []
        for winner in all_winners:
            winner_data = dict(winner)
            winner_data['_id'] = str(winner_data['_id'])
            winner_data['amount'] = float(winner_data.get('amount', 0.0))
            winner_data['payment_fee'] = float(winner_data.get('payment_fee', 0.0))

            if winner_data.get('image_path'):
                winner_data['image_url'] = url_for('static', filename=f"uploads/{winner_data['image_path']}")
            else:
                winner_data['image_url'] = url_for('static', filename='images/placeholder.png')

            serialized_winners.append(winner_data)

        return jsonify(serialized_winners), 200
    except Exception as e:
        app_logger.error(f"Error fetching public winners API: {e}")
        return jsonify({'success': False, 'message': 'Failed to retrieve winner data.'}), 500

# PUBLIC API: Search for a winner by name or winning code
@app.route('/api/winners/search', methods=['GET'])
def search_public_winners():
    query = request.args.get('query', '').strip()

    if not query:
        return jsonify([]), 200

    try:
        search_results_cursor = winners_collection.find({
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"winning_code": {"$regex": query, "$options": "i"}}
            ]
        }).limit(1)

        search_results_list = []
        for winner in search_results_cursor:
            winner_data = dict(winner)
            winner_data['_id'] = str(winner_data['_id'])
            winner_data['amount'] = float(winner_data.get('amount', 0.0))
            winner_data['payment_fee'] = float(winner_data.get('payment_fee', 0.0))
            
            if winner_data.get('image_path'):
                winner_data['image_url'] = url_for('static', filename=f"uploads/{winner_data['image_path']}")
            else:
                winner_data['image_url'] = url_for('static', filename='images/placeholder.png')

            search_results_list.append(winner_data)

        return jsonify(search_results_list), 200

    except Exception as e:
        app_logger.error(f"Error searching public winners: {e}")
        return jsonify({"message": "An error occurred during search.", "success": False}), 500


@app.route('/api/submit_application', methods=['POST'])
def submit_application():
    try:
        # For multipart/form-data, use request.form for text fields and request.files for files
        
        full_name = request.form.get('fullName')
        mother_maiden_name = request.form.get('motherMaidenName')
        email = request.form.get('email')
        phone = request.form.get('phone')
        address = request.form.get('address')
        city = request.form.get('city') # Added to match form.html
        state = request.form.get('state') # Added to match form.html
        zip_code = request.form.get('zipCode') # Added to match form.html
        country = request.form.get('country') # Added to match form.html
        dob = request.form.get('dateOfBirth')
        gender = request.form.get('gender')
        occupation = request.form.get('occupation')
        monthly_income_str = request.form.get('monthlyIncome')
        delivery_preference = request.form.get('deliveryPreference')
        winning_code = request.form.get('winningCode')
        reason_for_applying = request.form.get('reason')
        # Ensure these match the `name` attributes in form.html if they are there
        # reference = request.form.get('reference')
        # heard_about_us = request.form.get('heardAboutUs')


        required_fields = {
            'fullName': full_name, 'email': email, 'phone': phone, 'address': address,
            'city': city, 'state': state, 'zipCode': zip_code, 'country': country, # Now required
            'dateOfBirth': dob, 'gender': gender, 'occupation': occupation,
            'monthlyIncome': monthly_income_str, 'deliveryPreference': delivery_preference,
            'winningCode': winning_code, 'reason': reason_for_applying,
            'motherMaidenName': mother_maiden_name
        }
        
        missing_fields = [field for field, value in required_fields.items() if not value]
        if missing_fields:
            return jsonify({'success': False, 'message': f'Missing required field(s): {", ".join(missing_fields)}'}), 400

        try:
            monthly_income = float(monthly_income_str)
        except ValueError:
            return jsonify({'success': False, 'message': 'Monthly Income must be a valid number.'}), 400

        if not "@" in email or not "." in email:
            return jsonify({'success': False, 'message': 'Invalid email format.'}), 400

        # Handle file uploads for ID Card(s)
        id_card_paths = []
        if 'idCard' in request.files:
            files = request.files.getlist('idCard') # Use getlist for multiple files
            if not files or all(f.filename == '' for f in files):
                 return jsonify({'success': False, 'message': 'ID Card upload is required.'}), 400

            for file in files:
                if file.filename == '':
                    continue # Skip empty file input
                if file and allowed_file(file.filename, ALLOWED_ID_CARD_EXTENSIONS):
                    # Create a unique filename
                    unique_filename = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
                    file_path = os.path.join(app.config['ID_CARD_UPLOAD_FOLDER'], unique_filename)
                    file.save(file_path)
                    id_card_paths.append(unique_filename)
                else:
                    return jsonify({'success': False, 'message': 'Invalid ID card file type. Only PNG, JPG, JPEG, PDF allowed.'}), 400
        else:
            return jsonify({'success': False, 'message': 'ID Card upload is required.'}), 400


        application_data_to_save = {
            'fullName': full_name,
            'motherMaidenName': mother_maiden_name,
            'email': email,
            'phone': phone,
            'address': address,
            'city': city,
            'state': state,
            'zipCode': zip_code,
            'country': country,
            'dob': dob,
            'gender': gender,
            'occupation': occupation,
            'income': monthly_income,
            'deliveryPreference': delivery_preference,
            'winningCode': winning_code,
            'reasonForApplying': reason_for_applying,
            'idCardPaths': id_card_paths, # Store array of uploaded file paths
            'submission_date': datetime.utcnow(),
            'status': 'Pending'
            # 'reference': reference, # Add if collected in form.html
            # 'heardAboutUs': heard_about_us # Add if collected in form.html
        }

        result = applications_collection.insert_one(application_data_to_save)

        if not result.inserted_id:
            return jsonify({'success': False, 'message': 'Failed to save application to database.'}), 500

        # --- Email Notification for Admin ---
        email_subject = "🌟 New Grant Application Submitted! 🌟"
        
        # Build list of uploaded ID card URLs for the email
        id_card_links = ""
        if id_card_paths:
            for path in id_card_paths:
                # _external=True ensures a full URL is generated for external email clients
                file_url = url_for('static', filename=f"id_uploads/{path}", _external=True)
                id_card_links += f'<li><a href="{file_url}" target="_blank">{path}</a></li>'
            id_card_links = f"<ul>{id_card_links}</ul>"
        else:
            id_card_links = "N/A"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: 'Arial', sans-serif; background-color: #f0f4f8; margin: 0; padding: 0; }}
                .email-container {{ max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); border: 1px solid #e0e0e0; }}
                .header {{ background-color: #2c3e50; padding: 25px; text-align: center; color: #ecf0f1; font-size: 24px; font-weight: bold; }}
                .content {{ padding: 30px; color: #34495e; line-height: 1.6; }}
                .content p {{ margin-bottom: 15px; }}
                .details-table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                .details-table th, .details-table td {{ padding: 10px; border-bottom: 1px solid #eee; text-align: left; }}
                .details-table th {{ background-color: #f9f9f9; font-weight: bold; width: 35%; }}
                .footer {{ background-color: #ecf0f1; padding: 20px; text-align: center; font-size: 12px; color: #7f8c8d; border-top: 1px solid #e0e0e0; }}
                .highlight-text {{ color: #27ae60; font-weight: bold; }}
                .cta-button {{ display: inline-block; background-color: #3498db; color: #ffffff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 25px; box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3); transition: background-color 0.3s ease; }}
                .cta-button:hover {{ background-color: #2980b9; }}
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    New Grant Application Received!
                </div>
                <div class="content">
                    <p>Dear Administrator,</p>
                    <p>A <span class="highlight-text">new grant application</span> has been successfully submitted to The Global Fund.</p>
                    <p>Here are the details:</p>
                    <table class="details-table">
                        <tr><th>Full Name:</th><td>{full_name}</td></tr>
                        <tr><th>Mother's Maiden Name:</th><td>{mother_maiden_name}</td></tr>
                        <tr><th>Email:</th><td>{email}</td></tr>
                        <tr><th>Phone:</th><td>{phone}</td></tr>
                        <tr><th>Address:</th><td>{address}</td></tr>
                        <tr><th>City:</th><td>{city}</td></tr>
                        <tr><th>State:</th><td>{state}</td></tr>
                        <tr><th>Zip Code:</th><td>{zip_code}</td></tr>
                        <tr><th>Country:</th><td>{country}</td></tr>
                        <tr><th>Date of Birth:</th><td>{dob}</td></tr>
                        <tr><th>Gender:</th><td>{gender}</td></tr>
                        <tr><th>Occupation:</th><td>{occupation}</td></tr>
                        <tr><th>Monthly Income:</th><td>${monthly_income:,.2f}</td></tr>
                        <tr><th>Delivery Preference:</th><td>{delivery_preference}</td></tr>
                        <tr><th>Winning Code:</th><td>{winning_code}</td></tr>
                        <tr><th>Reason For Applying:</th><td>{reason_for_applying}</td></tr>
                        <tr><th>ID Cards Uploaded:</th><td>{id_card_links}</td></tr>
                        <tr><th>Submission Date:</th><td>{application_data_to_save['submission_date'].strftime('%Y-%m-%d %H:%M:%S UTC')}</td></tr>
                    </table>
                    <p style="margin-top: 25px;">Please log into the admin dashboard to review the full application and take necessary action:</p>
                    <p style="text-align: center;">
                        <a href="{url_for('admin_login_page', _external=True)}" class="cta-button">
                            Go to Admin Dashboard
                        </a>
                    </p>
                </div>
                <div class="footer">
                    This is an automated notification from The Global Fund.
                    <br>&copy; {datetime.now().year} The Global Fund. All rights reserved.
                </div>
            </div>
        </body>
        </html>
        """
        
        email_sent = send_email(email_subject, html_body, ADMIN_RECEIVING_EMAIL, html=True)
        
        if email_sent:
            return jsonify({'success': True, 'message': 'Application submitted successfully! We will review it shortly.'}), 201
        else:
            return jsonify({'success': True, 'message': 'Application submitted, but failed to send admin notification email. Please check server logs.'}), 201

    except Exception as e:
        app_logger.error(f"Error submitting application: {e}")
        # Log the full traceback for better debugging
        import traceback
        app_logger.error(traceback.format_exc())
        return jsonify({'success': False, 'message': f'An internal server error occurred: {str(e)}'}), 500

# Consolidated Add/Update Winner Endpoint (matching dashboard.js)
@app.route('/api/admin/winners', methods=['POST'], endpoint='add_winner_api')
@app.route('/api/admin/winners/<winner_id>', methods=['POST'], endpoint='update_winner_api')
@admin_required
def handle_winner_submission(winner_id=None):
    try:
        is_update = winner_id is not None and winner_id != '0'
        object_id = None
        winner = None

        if is_update:
            if not ObjectId.is_valid(winner_id):
                return jsonify({'success': False, 'message': 'Invalid winner ID format.'}), 400
            object_id = ObjectId(winner_id)
            winner = winners_collection.find_one({"_id": object_id})
            if not winner:
                return jsonify({'success': False, 'message': 'Winner not found!'}), 404

        winner_name = request.form.get('winner_name')
        winning_code = request.form.get('winning_code')
        winning_amount_str = request.form.get('winning_amount')
        winner_paymentfee_str = request.form.get('winner_paymentfee')

        if not winner_name or not winning_code or not winning_amount_str or not winner_paymentfee_str:
            return jsonify({'success': False, 'message': 'Please fill all required fields.'}), 400

        try:
            winning_amount = float(winning_amount_str)
            winner_paymentfee = float(winner_paymentfee_str)
        except ValueError:
            return jsonify({'success': False, 'message': 'Amount and Payment Fee must be valid numbers.'}), 400

        if winning_amount <= 0 or winner_paymentfee < 0:
            return jsonify({'success': False, 'message': 'Ensure amounts are valid (Amount > 0, Payment Fee >= 0).'}), 400

        updated_or_new_data = {
            "name": winner_name,
            "location": request.form.get('winner_location', ''),
            "winning_code": winning_code,
            "fb_link": request.form.get('winner_fblink', ''),
            "status": request.form.get('winner_status', 'Pending'),
            "amount": winning_amount,
            "payment_fee": winner_paymentfee,
            "currency": request.form.get('currency', 'USD'),
        }

        current_image_filename = winner.get('image_path') if winner else None
        image_filename_to_db = current_image_filename

        if 'winner_image' in request.files and request.files['winner_image'].filename != '':
            file = request.files['winner_image']
            if file and allowed_file(file.filename, ALLOWED_IMAGE_EXTENSIONS):
                if current_image_filename:
                    old_image_path_on_disk = os.path.join(app.config['UPLOAD_FOLDER'], current_image_filename)
                    if os.path.exists(old_image_path_on_disk):
                        os.remove(old_image_path_on_disk)
                unique_winner_filename = f"winner_{uuid.uuid4().hex}_{secure_filename(file.filename)}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_winner_filename)
                file.save(file_path)
                image_filename_to_db = unique_winner_filename
            else:
                return jsonify({'success': False, 'message': 'Invalid image file type for upload.'}), 400
        elif request.form.get('remove_image') == '1':
            if current_image_filename:
                old_image_path_on_disk = os.path.join(app.config['UPLOAD_FOLDER'], current_image_filename)
                if os.path.exists(old_image_path_on_disk):
                    os.remove(old_image_path_on_disk)
            image_filename_to_db = None

        updated_or_new_data['image_path'] = image_filename_to_db

        if is_update:
            result = winners_collection.update_one({"_id": object_id}, {"$set": updated_or_new_data})
            if result.matched_count == 0:
                return jsonify({'success': False, 'message': 'Winner not found during update.'}), 404
            if result.modified_count == 0:
                return jsonify({'success': True, 'message': 'No changes made to winner.'}), 200
            return jsonify({'success': True, 'message': 'Winner updated successfully!'})
        else:
            updated_or_new_data["created_at"] = datetime.utcnow()
            winners_collection.insert_one(updated_or_new_data)
            return jsonify({'success': True, 'message': 'New winner added successfully!'})

    except Exception as e:
        app_logger.error(f"Error handling winner submission: {e}")
        app_logger.error(traceback.format_exc())
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# Adjusted Delete Winner Endpoint to be RESTful
@app.route('/api/admin/winners/<winner_id>', methods=['DELETE'], endpoint='delete_winner_api')
@admin_required
def delete_winner(winner_id):
    try:
        if not ObjectId.is_valid(winner_id):
            return jsonify({'success': False, 'message': 'Invalid winner ID format.'}), 400

        object_id = ObjectId(winner_id)
        winner = winners_collection.find_one({"_id": object_id})
        if not winner:
            return jsonify({'success': False, 'message': 'Winner not found!'}), 404

        if winner.get('image_path'):
            image_file_path = os.path.join(app.config['UPLOAD_FOLDER'], winner['image_path'])
            if os.path.exists(image_file_path):
                os.remove(image_file_path)
                app_logger.info(f"Deleted image file: {image_file_path}")

        result = winners_collection.delete_one({"_id": object_id})
        if result.deleted_count == 0:
            return jsonify({'success': False, 'message': 'Winner not found or already deleted.'}), 404
        return jsonify({'success': True, 'message': 'Winner deleted successfully!'})
    except Exception as e:
        app_logger.error(f"Error deleting winner {winner_id}: {e}")
        app_logger.error(traceback.format_exc())
        return jsonify({'success': False, 'message': f'Error deleting winner: {str(e)}'}), 500

# API to update application status to 'Approved' and create a winner
@app.route('/admin/applications/<application_id>/approve', methods=['POST'])
@admin_required
def approve_application(application_id):
    try:
        if not ObjectId.is_valid(application_id):
            return jsonify({'success': False, 'message': 'Invalid application ID format.'}), 400

        object_id = ObjectId(application_id)
        application = applications_collection.find_one({"_id": object_id})

        if not application:
            return jsonify({'success': False, 'message': 'Application not found.'}), 404
        
        if application['status'] == 'Approved':
            return jsonify({'success': False, 'message': 'Application is already approved.'}), 400

        applications_collection.update_one(
            {"_id": object_id},
            {"$set": {"status": "Approved", "approved_at": datetime.utcnow()}}
        )

        existing_winner = winners_collection.find_one({"source_application_id": object_id})
        if existing_winner:
            app_logger.info(f"Winner for application {application_id} already exists, not creating duplicate.")
            return jsonify({'success': True, 'message': 'Application approved and winner already existed/updated.'}), 200

        new_winner_data = {
            "name": application.get('fullName', 'N/A'),
            "location": f"{application.get('city', 'N/A')}, {application.get('country', 'N/A')}",
            "winning_code": f"GF-{uuid.uuid4().hex[:6].upper()}",
            "fb_link": "", # Empty, admin can add later
            "status": "Pending",
            "amount": 50000.00, # Default winning amount, adjust as needed
            "payment_fee": 0.00, # Default payment fee, adjust as needed
            "currency": "USD",
            "image_path": None, # No image by default, admin can upload later
            "created_at": datetime.utcnow(),
            "source_application_id": object_id # Link to the original application
        }
        winners_collection.insert_one(new_winner_data)

        app_logger.info(f"Application {application_id} approved and winner created for {application.get('fullName', 'N/A')}.")
        return jsonify({'success': True, 'message': 'Application approved and winner added successfully!'}), 200

    except Exception as e:
        app_logger.error(f"Error approving application {application_id}: {e}")
        app_logger.error(traceback.format_exc())
        return jsonify({'success': False, 'message': f'Error approving application: {str(e)}'}), 500

# API to update application status to 'Rejected'
@app.route('/admin/applications/<application_id>/reject', methods=['POST'])
@admin_required
def reject_application(application_id):
    try:
        if not ObjectId.is_valid(application_id):
            return jsonify({'success': False, 'message': 'Invalid application ID format.'}), 400

        object_id = ObjectId(application_id)
        application = applications_collection.find_one({"_id": object_id})

        if not application:
            return jsonify({'success': False, 'message': 'Application not found.'}), 404
        
        if application['status'] == 'Rejected':
            return jsonify({'success': False, 'message': 'Application is already rejected.'}), 400

        applications_collection.update_one(
            {"_id": object_id},
            {"$set": {"status": "Rejected", "rejected_at": datetime.utcnow()}}
        )
        app_logger.info(f"Application {application_id} for {application.get('fullName', 'N/A')} rejected.")
        return jsonify({'success': True, 'message': 'Application rejected successfully!'}), 200

    except Exception as e:
        app_logger.error(f"Error rejecting application {application_id}: {e}")
        app_logger.error(traceback.format_exc())
        return jsonify({'success': False, 'message': f'Error rejecting application: {str(e)}'}), 500

# API to update winner status
@app.route('/api/admin/winners/<winner_id>/status', methods=['POST'])
@admin_required
def update_winner_status(winner_id):
    try:
        if not ObjectId.is_valid(winner_id):
            return jsonify({'success': False, 'message': 'Invalid winner ID format.'}), 400
        
        data = request.get_json()
        new_status = data.get('status')

        if not new_status or new_status not in ["Pending", "Claimed", "Delivered", "Cancelled"]:
            return jsonify({'success': False, 'message': 'Invalid status provided.'}), 400

        object_id = ObjectId(winner_id)
        result = winners_collection.update_one(
            {"_id": object_id},
            {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
        )

        if result.matched_count == 0:
            return jsonify({'success': False, 'message': 'Winner not found.'}), 404
        if result.modified_count == 0:
            return jsonify({'success': True, 'message': 'No change in status.'}), 200

        app_logger.info(f"Winner {winner_id} status updated to {new_status}.")
        return jsonify({'success': True, 'message': f'Winner status updated to {new_status}!'}), 200

    except Exception as e:
        app_logger.error(f"Error updating winner status for {winner_id}: {e}")
        app_logger.error(traceback.format_exc())
        return jsonify({'success': False, 'message': f'Error updating winner status: {str(e)}'}), 500


@app.route('/api/login', methods=['POST'], endpoint='login_user')
def login_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    user = admin_collection.find_one({"username": username})

    if user and user.get('password_hash') and bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
        session['admin_logged_in'] = True
        session['admin_username'] = username
        return jsonify({"message": "Login successful"}), 200
    else:
        return jsonify({"message": "Invalid username or password"}), 401


if __name__ == '__main__':
    # Initial setup for admin user
    if admin_collection.count_documents({"username": "admin"}) == 0:
        app_logger.info(f"Creating default admin user in '{admin_collection.name}' collection...")
        initial_admin_password = os.getenv('INITIAL_ADMIN_PASSWORD', 'theglobalfund2025') 
        hashed_password = bcrypt.hashpw(initial_admin_password.encode('utf-8'), bcrypt.gensalt())
        admin_collection.insert_one({
            "username": "admin",
            "password_hash": hashed_password
        })
        app_logger.info(f"Default admin user 'admin' created. Password: '{initial_admin_password}'. CHANGE THIS IMMEDIATELY IN PRODUCTION!")
    else:
        app_logger.info("Admin user 'admin' already exists. Skipping default creation.")

    # Initial setup for dummy winner data (Only insert if collection is empty)
    if winners_collection.count_documents({}) == 0:
        app_logger.info("Inserting dummy winner data...")
        dummy_winners = [
            {"name": "PAMELA DOUCET", "location": "Houston, Texas", "winning_code": "PD123", "fb_link": "https://facebook.com/pameladoucet", "status": "Claimed", "amount": 43370.00, "payment_fee": 0.00, "image_path": "winner_pamela.jpeg", "currency": "USD", "created_at": datetime.utcnow(), "source_application_id": None},
            {"name": "EDWARD HARGRAVE", "location": "Washington DC", "winning_code": "EH456", "fb_link": "https://facebook.com/edwardhargrave", "status": "Claimed", "amount": 1000000.00, "payment_fee": 0.00, "image_path": "winner_edward.jpeg", "currency": "USD", "created_at": datetime.utcnow(), "source_application_id": None},
            {"name": "VICKI GREIF", "location": "Atlanta, Georgia", "winning_code": "VG789", "fb_link": "https://facebook.com/vickigreif", "status": "Delivered", "amount": 25000.00, "payment_fee": 0.00, "image_path": "winner_vicki.jpeg", "currency": "USD", "created_at": datetime.utcnow(), "source_application_id": None},
            {"name": "ADREA KASS", "location": "Kansas City", "winning_code": "AK012", "fb_link": "https://facebook.com/adreakass", "status": "Claimed", "amount": 1000000.00, "payment_fee": 0.00, "image_path": "winner_adrea.jpeg", "currency": "USD", "created_at": datetime.utcnow(), "source_application_id": None}
        ]
        winners_collection.insert_many(dummy_winners)
        app_logger.info("Dummy winner data inserted.")
    else:
        app_logger.info("Winner data already exists. Skipping dummy data insertion.")

    app.run(debug=True)