from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy import or_
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.exceptions import HTTPException
import secrets
import time
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
# Replace 'YOUR_PASSWORD' with your actual MySQL password. 
# We use mysql+pymysql to tell SQLAlchemy which driver to use.
# app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
# app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY')
# app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = os.environ.get('DATABASE_URL', 'mysql+pymysql://root:yourpassword@localhost/escrow_db')
app.config['SQLALCHEMY_DATABASE_URI'] = db

# Initialize the database
db = SQLAlchemy(app)


# --- DATABASE MODELS ---

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    wallet_address = db.Column(db.String(100), unique=True, nullable=True) 
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        """Hashes the password and saves it to the model."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Checks a plain-text password against the saved hash."""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {"id": self.id, "username": self.username, "wallet_address": self.wallet_address, "is_admin": self.id == 1}
    
class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Float, nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    icon = db.Column(db.String(10), nullable=True) # For Emojis [cite: 809]

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "desc": self.description,
            "price": self.price,
            "sellerId": self.seller_id,
            "icon": self.icon
        }

class Escrow(db.Model):
    __tablename__ = 'escrows'
    id = db.Column(db.Integer, primary_key=True)
    buyer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    arbiter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    status = db.Column(db.String(20), default='pending') 
    smart_contract_address = db.Column(db.String(100), nullable=True) 
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        seller = db.session.get(User, self.seller_id)
        arbiter = db.session.get(User, self.arbiter_id) if self.arbiter_id else None
        return {
            "id": self.id,
            "buyer_id": self.buyer_id,
            "seller_id": self.seller_id, 
            "amount": self.amount, 
            "status": self.status, 
            "contract": self.smart_contract_address,
            "arbiter_id": self.arbiter_id,
            "seller_wallet": seller.wallet_address if seller else None,
            "arbiter_wallet": arbiter.wallet_address if arbiter else None
        }


# --- INITIALIZATION ---
# This ensures tables are created in MySQL before the first request
with app.app_context():
    db.create_all()
    print("✅ Database tables verified/created successfully.")


# --- API ROUTES ---

@app.route('/')
def home():
    return jsonify({"status": "Escrow Backend is running with Flask-SQLAlchemy!"}), 200

# A test route to create a new user in the database
@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.get_json()
    
    # Require password in validation
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Missing username, email, or password"}), 400
        
    new_user = User(
        username=data.get('username'), 
        email=data.get('email'),
        wallet_address=data.get('wallet_address')
    )
    
    # Hash the password before saving!
    new_user.set_password(data.get('password'))
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User created successfully", "user": new_user.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username_or_email = data.get('username') or data.get('email')
    password = data.get('password')
    
    # Corrected variable check 
    if not username_or_email or not password:
        return jsonify({"error": "Missing username/email or password"}), 400
        
    user = User.query.filter(
        or_(User.username == username_or_email, User.email == username_or_email)
    ).first()
    
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401
        
    return jsonify({"message": "Login successful", "user": user.to_dict()}), 200
    
@app.route('/api/escrows', methods=['POST'])
def create_escrow():
    data = request.get_json()
    
    # 1. Validate that all required fields were provided
    if not data or not data.get('buyer_id') or not data.get('seller_id') or not data.get('amount'):
        return jsonify({"error": "Missing buyer_id, seller_id, or amount"}), 400
        
    # 2. Verify that both users actually exist in the database
    # SQLAlchemy's .get() method looks up a record by its primary key (id)
    buyer = db.session.get(User, data.get('buyer_id'))
    seller = db.session.get(User, data.get('seller_id'))
    
    if not buyer:
        return jsonify({"error": "Buyer not found"}), 404
    if not seller:
        return jsonify({"error": "Seller not found"}), 404
        
    # 3. Create the Escrow transaction
    new_escrow = Escrow(
        buyer_id=buyer.id,
        seller_id=seller.id,
        amount=float(data.get('amount')),
        # HARDCODED ADMIN ID: The company (User 1) is always the arbiter
        arbiter_id = 1
        # Note: 'status' will automatically default to 'pending' based on our model
    )
    
    try:
        db.session.add(new_escrow)
        db.session.commit()
        return jsonify({
            "message": "Escrow created successfully", 
            "escrow": new_escrow.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/escrows', methods=['GET'])
def get_all_escrows():
    # Fetch all records from the Escrow table
    escrows = Escrow.query.all()
    
    # Convert the Python objects into a list of dictionaries for JSON output
    return jsonify([escrow.to_dict() for escrow in escrows]), 200

@app.route('/api/escrows/<int:escrow_id>/status', methods=['PUT'])
def update_escrow_status(escrow_id):
    data = request.get_json()
    new_status = data.get('status')
    
    # NEW: Grab the real contract address sent from the Web3 frontend
    contract_address = data.get('contract_address')

    escrow = db.session.get(Escrow, escrow_id)
    if not escrow:
        return jsonify({"error": "Escrow transaction not found"}), 404

    current_status = escrow.status

    valid_transitions = {
        'pending': ['funded'],
        'funded': ['released', 'refunded', 'disputed'],
        'disputed': ['released', 'refunded'],
        'refunded': [],
        'released': []
    }

    if new_status not in valid_transitions.get(current_status, []):
        return jsonify({
            "error": f"Invalid transition. Cannot change status from '{current_status}' to '{new_status}'."
        }), 400

    # --- THE WEB3 FIX ---
    # Instead of running a mock function, just save the real address sent from Javascript!
    if current_status == 'pending' and new_status == 'funded':
        if not contract_address:
            return jsonify({"error": "Missing smart contract address from Web3 deployment"}), 400
        escrow.smart_contract_address = contract_address

    escrow.status = new_status
    
    try:
        db.session.commit()
        return jsonify({
            "message": f"Escrow successfully updated to {new_status}",
            "escrow": escrow.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/users/<int:user_id>/escrows', methods=['GET'])
def get_user_escrows(user_id):
    # 1. Verify the user actually exists first
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    # 2. Build the base query: Find escrows where user is buyer OR seller
    base_query = Escrow.query.filter(
        or_(Escrow.buyer_id == user_id, Escrow.seller_id == user_id)
    )
    
    # 3. Check if the frontend only wants 'active' transactions
    # (e.g., /api/users/1/escrows?filter=active)
    status_filter = request.args.get('filter')
    
    if status_filter == 'active':
        # Only grab escrows that are still in progress
        base_query = base_query.filter(Escrow.status.in_(['pending', 'funded', 'disputed']))
        
    # 4. Execute the query and fetch the results
    user_escrows = base_query.all()
    
    # 5. Return the list to the dashboard
    return jsonify([escrow.to_dict() for escrow in user_escrows]), 200

@app.route('/api/admin/disputes', methods=['GET'])
def get_all_disputes():
    # Fetch EVERY escrow on the platform that is currently disputed
    # In a production app, you'd add authentication here to ensure ONLY User 1 can call this route!
    disputed_escrows = Escrow.query.filter_by(status='disputed').all()
    
    return jsonify([escrow.to_dict() for escrow in disputed_escrows]), 200

@app.route('/api/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify([p.to_dict() for p in products]), 200

@app.route('/api/products', methods=['POST'])
def add_product():
    # This is for you to seed data via Postman
    data = request.get_json()
    new_product = Product(
        title=data['title'],
        description=data['desc'],
        price=data['price'],
        seller_id=data['sellerId'],
        icon=data.get('icon', '📦')
    )
    db.session.add(new_product)
    db.session.commit()
    return jsonify(new_product.to_dict()), 201

# --- GLOBAL ERROR HANDLERS ---

# 1. Handle 404 - Route Not Found
@app.errorhandler(404)
def resource_not_found(e):
    return jsonify({
        "error": "Not Found",
        "message": "The requested endpoint does not exist."
    }), 404

# 2. Handle 405 - Method Not Allowed (e.g., sending a GET to a POST route)
@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({
        "error": "Method Not Allowed",
        "message": "The HTTP method is not allowed for this requested URL."
    }), 405

# 3. Handle 500 & All Other Unhandled Python Exceptions
@app.errorhandler(Exception)
def handle_exception(e):
    # If the error is a standard HTTP error, return its specific code and message
    if isinstance(e, HTTPException):
        return jsonify({
            "error": e.name,
            "message": e.description
        }), e.code

    # If it's a true server crash (like a database disconnect or a typo in your code)
    # we log the real error to the terminal, but send a generic safe message to the user.
    print(f"🚨 CRITICAL SERVER ERROR: {str(e)}")
    
    # Notice we use db.session.rollback() here just in case the error happened 
    # right in the middle of a database transaction.
    db.session.rollback() 
    
    return jsonify({
        "error": "Internal Server Error",
        "message": "Something went wrong on our end. Please try again later."
    }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)